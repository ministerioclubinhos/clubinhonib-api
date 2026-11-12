import { UserRole } from 'src/core/auth/auth.types';

/** Tipos de aviso persistido exibidos pela central. */
export enum NotificationType {
  FEED_COMMENT_REJECTED = 'FEED_COMMENT_REJECTED',
}

/** Filtro de leitura aplicado no SQL antes da paginação. */
export enum NotificationStatusFilter {
  ALL = 'all',
  UNREAD = 'unread',
}

/** Destinos internos conhecidos; a API nunca devolve URL arbitrária. */
export enum NotificationTargetKind {
  FEED_COMMENT = 'FEED_COMMENT',
}

export interface NotificationAccess {
  recipientId: string;
  role: UserRole;
  feedAvailable: boolean;
}
