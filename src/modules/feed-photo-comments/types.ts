import { UserRole } from 'src/core/auth/auth.types';

export enum PhotoCommentStatus {
  PENDING = 'pending',
  APPROVED = 'approved',
  REJECTED = 'rejected',
}

export interface PhotoCommentActor {
  userId: string;
  name: string;
  role: UserRole;
}

export enum PhotoCommentOrder {
  ASC = 'ASC',
  DESC = 'DESC',
}

export interface CreatePhotoCommentNotificationInput {
  recipientId: string;
  commentId: string;
  commentVersion: number;
  commentText: string;
  reason: string;
}

export interface PhotoCommentNotificationPageQuery {
  page: number;
  limit: number;
  unreadOnly: boolean;
}

export interface PhotoCommentNotificationRecentRow {
  id: string;
  createdAt: Date;
}

export interface PhotoCommentNotificationAggregate {
  total: number;
  unreadCount: number;
  /** Maior `updatedAt`, como texto cru do banco para não perder microssegundos. */
  lastChangedAt: string | null;
}

export interface PhotoCommentInboxAccess {
  actor: PhotoCommentActor;
  available: boolean;
}

export interface RawNotificationAggregate {
  total: string | number | null;
  unreadCount: string | number | null;
  lastChangedAt: string | Date | null;
}
