import { CreatePhotoCommentRejectionEmailService } from './create-photo-comment-rejection-email.service';
import { Injectable } from '@nestjs/common';
import {
  AppConflictException,
  AppNotFoundException,
  AppValidationException,
  ErrorCode,
} from 'src/shared/exceptions';
import { ModeratePhotoCommentDto } from '../dto/moderate-photo-comment.dto';
import { OwnPhotoCommentResponseDto } from '../dto/photo-comment-response.dto';
import { FeedPhotoCommentsRepository } from '../repositories/feed-photo-comments.repository';
import { toOwnPhotoComment } from '../utils';
import { GetFeedPhotoCommentsService } from './get-feed-photo-comments.service';
import {
  PhotoCommentStatus,
  CreatePhotoCommentNotificationInput,
} from '../types';

@Injectable()
export class UpdateFeedPhotoCommentService {
  constructor(
    private readonly repository: FeedPhotoCommentsRepository,
    private readonly get: GetFeedPhotoCommentsService,
    private readonly rejectionEmail: CreatePhotoCommentRejectionEmailService,
  ) {}

  async moderate(
    id: string,
    dto: ModeratePhotoCommentDto,
    userId: string,
  ): Promise<OwnPhotoCommentResponseDto> {
    const actor = await this.get.requireAdmin(userId);
    const comment = await this.repository.findById(id);
    if (!comment)
      throw new AppNotFoundException(
        ErrorCode.COMMENT_NOT_FOUND,
        'Comentário não encontrado.',
      );
    await this.get.requirePhoto(comment.mediaId, actor);
    let notification: CreatePhotoCommentNotificationInput | undefined;
    if (dto.status === PhotoCommentStatus.REJECTED) {
      const reason = dto.reason?.trim();
      if (!reason)
        throw new AppValidationException(
          ErrorCode.VALIDATION_ERROR,
          'Informe o motivo da reprovação.',
        );
      if (comment.status === PhotoCommentStatus.REJECTED)
        throw new AppConflictException(
          ErrorCode.RESOURCE_CONFLICT,
          'Este comentário já foi reprovado. Atualize a lista.',
        );
      notification = {
        recipientId: comment.authorId,
        commentId: id,
        commentVersion: dto.expectedVersion + 1,
        commentText: comment.text,
        reason,
      };
    }
    if (!(await this.repository.moderate(id, actor.userId, dto, notification)))
      throw new AppConflictException(
        ErrorCode.RESOURCE_CONFLICT,
        'Este comentário já foi alterado. Atualize a lista antes de moderar.',
      );
    if (notification)
      this.rejectionEmail.sendInBackground(comment.author, notification);
    const updated = await this.repository.findById(id);
    if (!updated)
      throw new AppNotFoundException(
        ErrorCode.COMMENT_NOT_FOUND,
        'Comentário não encontrado.',
      );
    return toOwnPhotoComment(updated);
  }
}
