import {
  Injectable,
  Logger,
  OnApplicationBootstrap,
  Optional,
  ServiceUnavailableException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  PDF_CONVERSION_CACHE_MAX_BYTES,
  PDF_CONVERSION_CACHE_MAX_ENTRIES,
  PDF_CONVERSION_CONCURRENCY_ENV,
  PDF_CONVERSION_CONCURRENCY_LEGACY_ENV,
  PDF_CONVERSION_DEFAULT_CONCURRENCY,
  PDF_CONVERSION_DEFAULT_MAX_QUEUED,
  PDF_CONVERSION_QUEUE_TIMEOUT_MS,
  PDF_CONVERSION_STDERR_LIMIT_BYTES,
  PDF_CONVERSION_TIMEOUT_MS,
  PDF_CONVERSION_VERSION_CHECK_TIMEOUT_MS,
  PDF_CONVERTER_BINARY,
  PDF_FILE_SIGNATURE,
} from '../constants/pdf-conversion.constants';
import type {
  PdfConversionWaiter,
  PdfLibreOfficeOptions,
  PdfSourceExtension,
  SofficeExecFn,
} from '../types/pdf-conversion.types';
import { runSofficeProcess } from '../utils/soffice-process.utils';

export type {
  PdfLibreOfficeOptions,
  SofficeExecFn,
} from '../types/pdf-conversion.types';

@Injectable()
export class PdfLibreOfficeService implements OnApplicationBootstrap {
  private readonly logger = new Logger(PdfLibreOfficeService.name);
  private readonly maxConcurrent: number;
  private readonly maxQueued: number;
  private readonly queueTimeoutMs: number;
  private readonly conversionTimeoutMs: number;
  private readonly cacheMaxEntries: number;
  private readonly cacheMaxBytes: number;
  private readonly temporaryRoot: string;
  private readonly execFn: SofficeExecFn;
  private activeCount = 0;
  private readonly waitQueue: PdfConversionWaiter[] = [];
  /** Insertion order is recency: the first key is the least recently used. */
  private readonly cache = new Map<string, Buffer>();
  private cacheBytes = 0;
  private readonly inFlight = new Map<string, Promise<Buffer>>();

  constructor(
    @Optional() options?: PdfLibreOfficeOptions,
    @Optional() private readonly config?: ConfigService,
  ) {
    this.maxConcurrent =
      options?.maxConcurrent ??
      this.positiveInteger(PDF_CONVERSION_CONCURRENCY_ENV) ??
      this.positiveInteger(PDF_CONVERSION_CONCURRENCY_LEGACY_ENV) ??
      PDF_CONVERSION_DEFAULT_CONCURRENCY;
    this.maxQueued = options?.maxQueued ?? PDF_CONVERSION_DEFAULT_MAX_QUEUED;
    this.queueTimeoutMs =
      options?.queueTimeoutMs ?? PDF_CONVERSION_QUEUE_TIMEOUT_MS;
    this.conversionTimeoutMs =
      options?.conversionTimeoutMs ?? PDF_CONVERSION_TIMEOUT_MS;
    this.cacheMaxEntries =
      options?.cacheMaxEntries ?? PDF_CONVERSION_CACHE_MAX_ENTRIES;
    this.cacheMaxBytes =
      options?.cacheMaxBytes ?? PDF_CONVERSION_CACHE_MAX_BYTES;
    this.temporaryRoot = options?.temporaryRoot ?? tmpdir();
    this.execFn = options?.execFn ?? runSofficeProcess;
  }

  /** Warns at boot (never blocks it) when the converter is not installed. */
  onApplicationBootstrap(): void {
    if (this.config?.get<string>('NODE_ENV') === 'test') return;
    void this.execFn(PDF_CONVERTER_BINARY, ['--version'], {
      timeout: PDF_CONVERSION_VERSION_CHECK_TIMEOUT_MS,
      maxBuffer: PDF_CONVERSION_STDERR_LIMIT_BYTES,
    }).catch((error: unknown) => {
      this.logger.warn(
        `LibreOffice (${PDF_CONVERTER_BINARY}) indisponível: prévias e publicações em PDF falharão até que seja instalado. ${error instanceof Error ? error.message : String(error)}`,
      );
    });
  }

  private positiveInteger(key: string): number | undefined {
    const value = Number(this.config?.get<string>(key));
    return Number.isInteger(value) && value > 0 ? value : undefined;
  }

  private async acquireSlot(): Promise<void> {
    if (this.activeCount < this.maxConcurrent) {
      this.activeCount += 1;
      return;
    }
    if (this.waitQueue.length >= this.maxQueued) {
      throw new ServiceUnavailableException(
        'Há muitas conversões de PDF em andamento. Tente novamente em instantes.',
      );
    }
    await new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => {
        const index = this.waitQueue.findIndex((item) => item.timer === timer);
        if (index >= 0) {
          this.waitQueue.splice(index, 1);
        }
        reject(
          new ServiceUnavailableException(
            'Fila de conversão PDF ocupada no momento. Tente novamente em instantes.',
          ),
        );
      }, this.queueTimeoutMs);
      this.waitQueue.push({ resolve, reject, timer });
    });
  }

  private releaseSlot(): void {
    const next = this.waitQueue.shift();
    if (next) {
      // The slot is handed over directly, so `activeCount` does not change.
      clearTimeout(next.timer);
      next.resolve();
      return;
    }
    this.activeCount = Math.max(0, this.activeCount - 1);
  }

  private cached(key: string): Buffer | undefined {
    const hit = this.cache.get(key);
    if (!hit) return undefined;
    this.cache.delete(key);
    this.cache.set(key, hit);
    return hit;
  }

  private remember(key: string, pdf: Buffer): void {
    if (this.cacheMaxEntries <= 0 || pdf.length > this.cacheMaxBytes) return;
    const previous = this.cache.get(key);
    if (previous) {
      this.cacheBytes -= previous.length;
      this.cache.delete(key);
    }
    this.cache.set(key, pdf);
    this.cacheBytes += pdf.length;
    while (
      this.cache.size > this.cacheMaxEntries ||
      this.cacheBytes > this.cacheMaxBytes
    ) {
      const oldest = this.cache.keys().next();
      if (oldest.done) break;
      this.cacheBytes -= this.cache.get(oldest.value)?.length ?? 0;
      this.cache.delete(oldest.value);
    }
  }

  /**
   * @param cacheKey Identifies immutable source content (for the Studio, the
   * version id plus its content checksum). When given, a repeated conversion
   * is served from memory and concurrent requests share one LibreOffice run.
   * Omit it for content that may change under the same identifier.
   */
  async convertDocxToPdf(
    docxBuffer: Buffer,
    cacheKey?: string,
  ): Promise<Buffer> {
    return this.convertToPdf(docxBuffer, '.docx', cacheKey);
  }

  async convertToPdf(
    docxBuffer: Buffer,
    extension: PdfSourceExtension,
    cacheKey?: string,
  ): Promise<Buffer> {
    if (!cacheKey) return this.convert(docxBuffer, extension);
    const key = `${extension}:${cacheKey}`;
    const hit = this.cached(key);
    if (hit) return hit;
    const pending = this.inFlight.get(key);
    if (pending) return pending;
    const conversion = this.convert(docxBuffer, extension)
      .then((pdf) => {
        this.remember(key, pdf);
        return pdf;
      })
      .finally(() => this.inFlight.delete(key));
    this.inFlight.set(key, conversion);
    return conversion;
  }

  private async convert(
    docxBuffer: Buffer,
    extension: PdfSourceExtension,
  ): Promise<Buffer> {
    await this.acquireSlot();
    let dir: string | undefined;
    try {
      // Inside the try: a failing mkdtemp must still release the slot.
      dir = await mkdtemp(join(this.temporaryRoot, 'clubinho-pdf-'));
      const profile = join(dir, 'profile');
      const source = join(dir, `lesson${extension}`);
      const output = join(dir, 'lesson.pdf');
      await writeFile(source, docxBuffer);
      await this.execFn(
        PDF_CONVERTER_BINARY,
        [
          `-env:UserInstallation=file://${profile}`,
          '--headless',
          '--nologo',
          '--nodefault',
          '--nolockcheck',
          '--norestore',
          '--convert-to',
          'pdf',
          '--outdir',
          dir,
          source,
        ],
        {
          timeout: this.conversionTimeoutMs,
          maxBuffer: PDF_CONVERSION_STDERR_LIMIT_BYTES,
        },
      );
      const pdf = await readFile(output);
      if (
        pdf.length < PDF_FILE_SIGNATURE.length ||
        pdf.subarray(0, PDF_FILE_SIGNATURE.length).toString() !==
          PDF_FILE_SIGNATURE
      )
        throw new UnprocessableEntityException(
          'LibreOffice não produziu um PDF válido.',
        );
      return pdf;
    } catch (error: unknown) {
      if (
        error instanceof UnprocessableEntityException ||
        error instanceof ServiceUnavailableException
      ) {
        throw error;
      }
      // The raw message carries the command line and server paths: log only.
      this.logger.error(
        `Falha na conversão PDF pelo LibreOffice: ${error instanceof Error ? error.message : String(error)}`,
      );
      throw new ServiceUnavailableException(
        'Não foi possível converter o documento em PDF no momento. Tente novamente em instantes.',
      );
    } finally {
      if (dir)
        await rm(dir, { recursive: true, force: true }).catch(() => undefined);
      this.releaseSlot();
    }
  }
}
