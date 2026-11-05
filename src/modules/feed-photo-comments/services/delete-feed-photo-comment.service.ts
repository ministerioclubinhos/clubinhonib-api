import { Injectable } from '@nestjs/common';
import { UserRole } from 'src/core/auth/auth.types';
import { AppNotFoundException, ErrorCode } from 'src/shared/exceptions';
import { PhotoCommentDeletedDto } from '../dto/photo-comment-response.dto';
import { FeedPhotoCommentsRepository } from '../repositories/feed-photo-comments.repository';
import { GetFeedPhotoCommentsService } from './get-feed-photo-comments.service';

@Injectable()
export class DeleteFeedPhotoCommentService {
  constructor(
    private readonly repository: FeedPhotoCommentsRepository,
    private readonly get: GetFeedPhotoCommentsService,
  ) {}

  async remove(id: string, userId: string): Promise<PhotoCommentDeletedDto> {
    const actor = await this.get.requireActiveActor(userId);
    if (actor.role === UserRole.ADMIN) await this.get.requireAdmin(userId);
    const comment = await this.repository.findById(id);
    if (
      !comment ||
      (comment.authorId !== actor.userId && actor.role !== UserRole.ADMIN)
    )
      throw new AppNotFoundException(
        ErrorCode.COMMENT_NOT_FOUND,
        'Comentário não encontrado.',
      );
    await this.get.requirePhoto(comment.mediaId, actor);
    await this.repository.delete(id);
    return { message: 'Comentário excluído.' };
  }
}
