export const AUDIT_SCHEMA_VERSION = '1';
export const AUDIT_QUEUE_NAME = 'audit';

/**
 * Únicos parâmetros de rota aceitos como `resourceId` (D-020).
 *
 * São identificadores técnicos (UUID) de recursos, nunca dado pessoal; nomes,
 * datas e anos ficam de fora porque descrevem conteúdo, não identidade.
 */
export const SAFE_RESOURCE_ID_PARAMS: readonly string[] = [
  'id',
  'clubId',
  'teacherId',
  'coordinatorId',
  'fromCoordinatorId',
  'pageId',
  'childId',
  'key',
  'eventId',
];

/**
 * Só mutações entram na auditoria (decisão do solicitante, 2026-09-05):
 * leituras não são "ações" auditáveis, e os erros delas já ficam na
 * observabilidade.
 */
export const AUDITED_HTTP_METHODS: ReadonlySet<string> = new Set([
  'POST',
  'PUT',
  'PATCH',
  'DELETE',
]);

export const RESOURCE_ID_MAX_LENGTH = 128;
export const ACTION_NAME_MAX_LENGTH = 300;

/** Campos que compõem o fingerprint de desduplicação, em ordem canônica. */
export const AUDIT_FINGERPRINT_FIELDS: readonly string[] = [
  'actionName',
  'actionType',
  'actorId',
  'actorType',
  'errorCode',
  'httpMethod',
  'outcome',
  'resourceId',
  'resourceType',
  'routeTemplate',
  'statusCode',
];

export const AUDIT_FINGERPRINT_LENGTH = 32;

/**
 * Filtro de ruído da auditoria: ações bem-sucedidas que não dizem nada a quem
 * audita. Só o sucesso é silenciado; falha, negação e rejeição das mesmas
 * ações continuam sendo gravadas.
 *
 * - `scheduler-heartbeat`: batimento do agendador, sem efeito de negócio;
 * - `AuthController.refresh`: renovação automática de token feita pelo app;
 * - `FeedPhotoCommentsController.readNotification`: marcar notificação como lida.
 */
export const AUDIT_SILENT_SUCCESS_JOBS: ReadonlySet<string> = new Set([
  'scheduler-heartbeat',
]);
export const AUDIT_SILENT_SUCCESS_HANDLERS: ReadonlySet<string> = new Set([
  'AuthController.refresh',
  'FeedPhotoCommentsController.readNotification',
]);
