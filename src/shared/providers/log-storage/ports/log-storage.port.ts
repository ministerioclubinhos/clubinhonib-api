import {
  DedupClaim,
  DedupClaimInput,
  LogRecord,
  LogRecordPage,
  LogRecordQuery,
  LogRecordRange,
  LogRecordReference,
} from '../types';

/**
 * O que um storage de registros sabe fazer, seja arquivo ou DynamoDB.
 *
 * Quem escreve eventos nunca vê SDK ou file system: recebe uma destas portas
 * pela injeção e chama apenas estes métodos.
 */
export interface LogRecordStorage {
  /**
   * Se este storage atende consulta e exclusão pela API. `file` responde
   * `false`: os arquivos JSONL existem só para análise fora da aplicação.
   */
  readonly queryable: boolean;
  /**
   * Persiste um item novo; item repetido (mesmo eventId) é recusado.
   *
   * Um registro `audit_repeat` é a repetição de um evento dentro da janela de
   * desduplicação: o storage decide se vira contador ou linha própria.
   */
  write(record: LogRecord): Promise<void>;
  /** Tenta abrir uma janela de desduplicação para o fingerprint. */
  claimDedup(input: DedupClaimInput): Promise<DedupClaim>;
  /** Consulta paginada por intervalo, tipo, correlação e filtros. */
  query(query: LogRecordQuery): Promise<LogRecordPage>;
  /** Apaga um item; `false` quando ele não existe. */
  delete(reference: LogRecordReference): Promise<boolean>;
  /** Apaga tudo do fluxo no intervalo; devolve quantos itens saíram. */
  deleteRange(range: LogRecordRange): Promise<number>;
  /** Encerra recursos e espera o que estiver pendente. */
  close(): Promise<void>;
}

/** Porta do fluxo técnico. Classe abstrata para servir de token de injeção. */
export abstract class ObservabilityStoragePort implements LogRecordStorage {
  abstract readonly queryable: boolean;
  abstract write(record: LogRecord): Promise<void>;
  abstract claimDedup(input: DedupClaimInput): Promise<DedupClaim>;
  abstract query(query: LogRecordQuery): Promise<LogRecordPage>;
  abstract delete(reference: LogRecordReference): Promise<boolean>;
  abstract deleteRange(range: LogRecordRange): Promise<number>;
  abstract close(): Promise<void>;
}

/** Porta do fluxo de auditoria. */
export abstract class AuditStoragePort implements LogRecordStorage {
  abstract readonly queryable: boolean;
  abstract write(record: LogRecord): Promise<void>;
  abstract claimDedup(input: DedupClaimInput): Promise<DedupClaim>;
  abstract query(query: LogRecordQuery): Promise<LogRecordPage>;
  abstract delete(reference: LogRecordReference): Promise<boolean>;
  abstract deleteRange(range: LogRecordRange): Promise<number>;
  abstract close(): Promise<void>;
}
