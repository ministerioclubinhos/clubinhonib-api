import { promises as fs } from 'node:fs';
import { join } from 'node:path';
import { OnApplicationBootstrap, OnApplicationShutdown } from '@nestjs/common';

import {
  FILE_DEDUP_MAX_ENTRIES,
  FILE_DIRECTORY_MODE,
  FILE_EXTENSION,
  FILE_MODE,
  FILE_NAME_PATTERN,
  FILE_RETENTION_INTERVAL_MS,
} from '../constants';
import { LogStream } from '../enums';
import { LogRecordStorage } from '../ports/log-storage.port';
import {
  Clock,
  DedupClaim,
  DedupClaimInput,
  DedupReference,
  EmergencySink,
  FileStorageConfig,
  LogRecord,
  LogRecordPage,
  LogRecordQuery,
  LogRecordRange,
  LogRecordReference,
  LogWriteError,
  LogWriteFailureKind,
} from '../types';
import {
  describeError,
  isLogicallyExpired,
  matchesFilters,
  physicalRecordTypes,
  serializeRecord,
  sliceForPage,
  utcDayOf,
  utcDaysBetweenDescending,
} from '../utils';

interface DedupWindow extends DedupReference {
  windowEndsAtMs: number;
}

/** Erros de disco que não melhoram tentando de novo. */
const PERMANENT_FS_CODES: ReadonlySet<string> = new Set([
  'ENOSPC',
  'EACCES',
  'EPERM',
  'EROFS',
  'ENAMETOOLONG',
]);

/**
 * Persistência local em JSONL: um objeto por linha, um arquivo por dia UTC e
 * por processo.
 *
 * Escrita é sempre `append`; nenhum arquivo é reescrito. A retenção apaga só
 * arquivos com o nome no padrão do provider e mais antigos que o TTL, nunca a
 * pasta. A desduplicação aqui vale por processo: entre processos só existiria
 * com trava compartilhada, e isso é papel do DynamoDB.
 */
export class FileLogStorage
  implements LogRecordStorage, OnApplicationBootstrap, OnApplicationShutdown
{
  /** Arquivos são só para análise: a API não lista nem apaga neste modo. */
  readonly queryable = false;

  private chain: Promise<void> = Promise.resolve();
  private retentionTimer: NodeJS.Timeout | null = null;
  private readonly dedup = new Map<string, DedupWindow>();
  private directoryReady = false;

  constructor(
    private readonly config: FileStorageConfig,
    private readonly stream: LogStream,
    private readonly ttlDays: number,
    private readonly clock: Clock,
    private readonly emergency: EmergencySink,
    private readonly processId: number = process.pid,
  ) {}

  get directory(): string {
    return this.config.directory;
  }

  async onApplicationBootstrap(): Promise<void> {
    await this.start();
  }

  async onApplicationShutdown(): Promise<void> {
    await this.close();
  }

  /** Cria a pasta, roda a retenção e agenda as próximas. */
  async start(): Promise<void> {
    await this.ensureDirectory();
    await this.runRetention();
    this.retentionTimer = setInterval(() => {
      void this.runRetention();
    }, FILE_RETENTION_INTERVAL_MS);
    this.retentionTimer.unref();
  }

  async close(): Promise<void> {
    if (this.retentionTimer) {
      clearInterval(this.retentionTimer);
      this.retentionTimer = null;
    }
    await this.chain;
  }

  async write(record: LogRecord): Promise<void> {
    let line: string;
    try {
      line = serializeRecord(record);
    } catch (error: unknown) {
      throw new LogWriteError(
        'registro excede o tamanho máximo',
        LogWriteFailureKind.Permanent,
        error,
      );
    }
    const file = this.fileFor(record.occurredAt);
    const append = this.chain.then(() => this.append(file, line));
    this.chain = append.catch(() => undefined);
    await append;
  }

  claimDedup(input: DedupClaimInput): Promise<DedupClaim> {
    const now = this.clock().getTime();
    const existing = this.dedup.get(input.fingerprint);
    if (existing && existing.windowEndsAtMs > now) {
      return Promise.resolve({
        fingerprint: input.fingerprint,
        duplicateOf: {
          eventId: existing.eventId,
          occurredAt: existing.occurredAt,
        },
      });
    }
    this.dedup.set(input.fingerprint, {
      eventId: input.eventId,
      occurredAt: input.occurredAt,
      windowEndsAtMs: now + input.windowSeconds * 1000,
    });
    this.pruneDedup(now);
    return Promise.resolve({
      fingerprint: input.fingerprint,
      duplicateOf: null,
    });
  }

  async query(query: LogRecordQuery): Promise<LogRecordPage> {
    const now = this.clock();
    const fromIso = query.from.toISOString();
    const toIso = query.to.toISOString();
    const matches: LogRecord[] = [];

    for (const day of utcDaysBetweenDescending(query.from, query.to)) {
      for (const file of await this.filesForDay(day)) {
        for (const record of await this.readRecords(file)) {
          if (record.recordType !== query.recordType) continue;
          if (record.occurredAt < fromIso || record.occurredAt > toIso)
            continue;
          if (query.requestId && record.requestId !== query.requestId) continue;
          if (!matchesFilters(record, query.filters)) continue;
          if (isLogicallyExpired(record, now)) continue;
          matches.push(record);
        }
      }
    }

    matches.sort((a, b) =>
      a.occurredAt === b.occurredAt
        ? b.eventId.localeCompare(a.eventId)
        : b.occurredAt.localeCompare(a.occurredAt),
    );

    return {
      items: sliceForPage(matches, query.page, query.limit),
      total: matches.length,
      page: query.page,
      limit: query.limit,
    };
  }

  async delete(reference: LogRecordReference): Promise<boolean> {
    let removed = 0;
    for (const file of await this.filesForDay(utcDayOf(reference.occurredAt))) {
      removed += await this.rewrite(
        file,
        (record) =>
          !(
            record.eventId === reference.eventId &&
            record.recordType === reference.recordType
          ),
      );
    }
    return removed > 0;
  }

  async deleteRange(range: LogRecordRange): Promise<number> {
    const types = new Set<string>(physicalRecordTypes(range.recordType));
    const fromIso = range.from.toISOString();
    const toIso = range.to.toISOString();
    let removed = 0;
    for (const day of utcDaysBetweenDescending(range.from, range.to)) {
      for (const file of await this.filesForDay(day)) {
        removed += await this.rewrite(
          file,
          (record) =>
            !types.has(record.recordType) ||
            record.occurredAt < fromIso ||
            record.occurredAt > toIso,
        );
      }
    }
    return removed;
  }

  /** Remove arquivos do provider mais antigos que o TTL. */
  async runRetention(): Promise<void> {
    // Cópia: o relógio pode devolver a mesma instância, e ela não é nossa.
    const cutoff = new Date(this.clock().getTime());
    cutoff.setUTCDate(cutoff.getUTCDate() - this.ttlDays);
    const cutoffDay = utcDayOf(cutoff);

    let names: string[];
    try {
      names = await fs.readdir(this.config.directory);
    } catch (error: unknown) {
      this.emergency(this.componentName(), 'retenção não listou a pasta', {
        error: describeError(error),
      });
      return;
    }

    for (const name of names) {
      const match = FILE_NAME_PATTERN.exec(name);
      if (!match || match[1] >= cutoffDay) continue;
      try {
        await fs.unlink(join(this.config.directory, name));
      } catch (error: unknown) {
        this.emergency(this.componentName(), 'retenção não apagou arquivo', {
          file: name,
          error: describeError(error),
        });
      }
    }
  }

  private componentName(): string {
    return `file-storage:${this.stream}`;
  }

  private fileFor(occurredAt: string): string {
    return join(
      this.config.directory,
      `${utcDayOf(occurredAt)}.${this.processId}${FILE_EXTENSION}`,
    );
  }

  private async ensureDirectory(): Promise<void> {
    if (this.directoryReady) return;
    await fs.mkdir(this.config.directory, {
      recursive: true,
      mode: FILE_DIRECTORY_MODE,
    });
    this.directoryReady = true;
  }

  private async append(file: string, line: string): Promise<void> {
    try {
      await this.ensureDirectory();
      await fs.appendFile(file, `${line}\n`, {
        encoding: 'utf8',
        mode: FILE_MODE,
        flag: 'a',
      });
    } catch (error: unknown) {
      const code = (error as { code?: string }).code ?? '';
      this.directoryReady = code !== 'ENOENT' && this.directoryReady;
      throw new LogWriteError(
        `falha ao gravar em ${file}`,
        PERMANENT_FS_CODES.has(code)
          ? LogWriteFailureKind.Permanent
          : LogWriteFailureKind.Transient,
        error,
      );
    }
  }

  /**
   * Reescreve o arquivo mantendo só o que `keep` aprova; devolve quantas
   * linhas saíram.
   *
   * Entra na mesma fila das escritas para não cruzar com um `append`; grava
   * em arquivo temporário e renomeia, para uma queda no meio não deixar o
   * arquivo pela metade. Vazio, o arquivo é removido.
   */
  private rewrite(
    file: string,
    keep: (record: LogRecord) => boolean,
  ): Promise<number> {
    const task = this.chain.then(async () => {
      const records = await this.readRecords(file);
      const kept = records.filter(keep);
      const removed = records.length - kept.length;
      if (removed === 0) return 0;
      if (kept.length === 0) {
        await fs.unlink(file);
        return removed;
      }
      const temporary = `${file}.tmp`;
      await fs.writeFile(
        temporary,
        `${kept.map((record) => JSON.stringify(record)).join('\n')}\n`,
        { encoding: 'utf8', mode: FILE_MODE },
      );
      await fs.rename(temporary, file);
      return removed;
    });
    this.chain = task.then(
      () => undefined,
      () => undefined,
    );
    return task;
  }

  private async filesForDay(day: string): Promise<string[]> {
    let names: string[];
    try {
      names = await fs.readdir(this.config.directory);
    } catch {
      return [];
    }
    return names
      .filter((name) => {
        const match = FILE_NAME_PATTERN.exec(name);
        return match !== null && match[1] === day;
      })
      .sort()
      .map((name) => join(this.config.directory, name));
  }

  /** Uma linha corrompida (processo caiu no meio) é pulada, não derruba. */
  private async readRecords(file: string): Promise<LogRecord[]> {
    let content: string;
    try {
      content = await fs.readFile(file, 'utf8');
    } catch {
      return [];
    }
    const records: LogRecord[] = [];
    for (const line of content.split('\n')) {
      if (!line.trim()) continue;
      try {
        const parsed: unknown = JSON.parse(line);
        if (isLogRecord(parsed)) records.push(parsed);
      } catch {
        this.emergency(this.componentName(), 'linha inválida ignorada', {
          file,
        });
      }
    }
    return records;
  }

  private pruneDedup(now: number): void {
    if (this.dedup.size <= FILE_DEDUP_MAX_ENTRIES) return;
    for (const [fingerprint, window] of this.dedup) {
      if (window.windowEndsAtMs <= now) this.dedup.delete(fingerprint);
    }
  }
}

const isLogRecord = (value: unknown): value is LogRecord =>
  typeof value === 'object' &&
  value !== null &&
  typeof (value as LogRecord).eventId === 'string' &&
  typeof (value as LogRecord).occurredAt === 'string' &&
  typeof (value as LogRecord).recordType === 'string' &&
  typeof (value as LogRecord).expiresAtEpochSeconds === 'number';
