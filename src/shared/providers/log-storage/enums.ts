/** Onde um fluxo de registros é persistido. */
export enum LogStorageKind {
  File = 'file',
  DynamoDb = 'dynamodb',
}

/** Os dois fluxos lógicos que compartilham a mesma tabela/pasta. */
export enum LogStream {
  Observability = 'observability',
  Audit = 'audit',
}

/**
 * Discriminador físico de cada item.
 *
 * `audit_dedup` é o marcador de janela de desduplicação e `audit_repeat` é a
 * repetição de um evento de auditoria dentro da janela; nenhum dos dois é
 * devolvido pela consulta administrativa.
 */
export enum LogRecordType {
  Observability = 'observability',
  Audit = 'audit',
  AuditDedup = 'audit_dedup',
  AuditRepeat = 'audit_repeat',
}

/** De que fronteira o registro nasceu. */
export enum LogSourceType {
  Http = 'http',
  Job = 'job',
  Provider = 'provider',
  Process = 'process',
  Bootstrap = 'bootstrap',
}

/** Quem executou a ação, quando é possível afirmar. */
export enum LogActorType {
  User = 'user',
  Anonymous = 'anonymous',
  System = 'system',
}
