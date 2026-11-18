import { Injectable, Logger } from '@nestjs/common';

import { CommentsRepository } from '../repositories/comments.repository';
import { UpdateCommentDto } from '../dto/update-comment.dto';
import { CommentResponseDto } from '../dto/comment-response.dto';
import { toCommentResponse } from '../mappers';
import { GetCommentsService } from './get-comments.service';

@Injectable()
export class UpdateCommentService {
  private readonly logger = new Logger(UpdateCommentService.name);

  constructor(
    private readonly commentsRepository: CommentsRepository,
    private readonly getService: GetCommentsService,
  ) {}

  /** Altera apenas os campos presentes no corpo. */
  async update(id: string, dto: UpdateCommentDto): Promise<CommentResponseDto> {
    const comment = await this.getService.findEntityOrFail(id);

    if (dto.name !== undefined) comment.name = dto.name;
    if (dto.comment !== undefined) comment.comment = dto.comment;
    if (dto.clubinho !== undefined) comment.clubinho = dto.clubinho;
    if (dto.neighborhood !== undefined) comment.neighborhood = dto.neighborhood;
    if (dto.published !== undefined) comment.published = dto.published;

    const saved = await this.commentsRepository.save(comment);
    this.logger.log(`Comentário atualizado. ID=${id}`);

    return toCommentResponse(saved);
  }

  /**
   * Publica ou despublica.
   *
   * Existe como rota própria porque alternar a publicação não deveria exigir
   * reenviar o comentário inteiro — era o que a tela fazia, e falhava.
   */
  async setPublished(
    id: string,
    published: boolean,
  ): Promise<CommentResponseDto> {
    const comment = await this.getService.findEntityOrFail(id);

    comment.published = published;
    const saved = await this.commentsRepository.save(comment);

    this.logger.log(
      `Comentário ${published ? 'publicado' : 'despublicado'}. ID=${id}`,
    );

    return toCommentResponse(saved);
  }
}
