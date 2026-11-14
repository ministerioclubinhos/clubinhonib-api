import { Injectable } from '@nestjs/common';
import { AppConflictException, ErrorCode } from 'src/shared/exceptions';
import { CreatePhotoCommentDto } from '../dto/create-photo-comment.dto';
import { OwnPhotoCommentResponseDto } from '../dto/photo-comment-response.dto';
import {
  PHOTO_COMMENT_RATE_LIMIT,
  PHOTO_COMMENT_RATE_WINDOW_MS,
} from '../constants';
import { FeedPhotoCommentsRepository } from '../repositories/feed-photo-comments.repository';
import { toOwnPhotoComment } from '../utils';
import { GetFeedPhotoCommentsService } from './get-feed-photo-comments.service';

@Injectable()
export class CreateFeedPhotoCommentService {
  constructor(
    private readonly repository: FeedPhotoCommentsRepository,
    private readonly get: GetFeedPhotoCommentsService,
  ) {}

  async create(
    mediaId: string,
    dto: CreatePhotoCommentDto,
    userId: string,
  ): Promise<OwnPhotoCommentResponseDto> {
    const actor = await this.get.requireActiveActor(userId);
    await this.get.requirePhoto(mediaId, actor);
    return this.repository.withAuthorLock(actor.userId, async (manager) => {
      const existing = await this.repository.findRequest(
        actor.userId,
        dto.requestId,
        manager,
      );
      if (existing) {
        if (existing.mediaId !== mediaId || existing.text !== dto.text)
          throw new AppConflictException(
            ErrorCode.RESOURCE_CONFLICT,
            'Este envio já foi usado para outro comentário.',
          );
        return toOwnPhotoComment(existing);
      }
      const recent = await this.repository.countRecent(
        actor.userId,
        new Date(Date.now() - PHOTO_COMMENT_RATE_WINDOW_MS),
        manager,
      );
      if (recent >= PHOTO_COMMENT_RATE_LIMIT)
        throw new AppConflictException(
          ErrorCode.RESOURCE_CONFLICT,
          'Você enviou vários comentários. Aguarde um minuto antes de tentar novamente.',
        );
      return toOwnPhotoComment(
        await this.repository.createPending(
          actor.userId,
          mediaId,
          dto.text,
          dto.requestId,
          manager,
        ),
      );
    });
  }
}
