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
