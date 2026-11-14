import { Injectable, Logger } from '@nestjs/common';

import { CommentsRepository } from '../repositories/comments.repository';
import { GetCommentsService } from './get-comments.service';

@Injectable()
export class DeleteCommentService {
  private readonly logger = new Logger(DeleteCommentService.name);

  constructor(
    private readonly commentsRepository: CommentsRepository,
    private readonly getService: GetCommentsService,
  ) {}

  async remove(id: string): Promise<{ message: string }> {
    await this.getService.findEntityOrFail(id);
    await this.commentsRepository.deleteById(id);

    this.logger.log(`Comentário removido. ID=${id}`);

    return { message: 'Comentário removido com sucesso' };
  }
}
