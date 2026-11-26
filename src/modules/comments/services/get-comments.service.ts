import { Injectable } from '@nestjs/common';

import { AppNotFoundException, ErrorCode } from 'src/shared/exceptions';
import { Paginated } from 'src/shared/dto/paginated.dto';

import { CommentsRepository } from '../repositories/comments.repository';
import { QueryCommentsDto } from '../dto/query-comments.dto';
import { CommentResponseDto } from '../dto/comment-response.dto';
import { CommentEntity } from '../entities/comment.entity';
import { toCommentResponse } from '../mappers';
import { COMMENTS_DEFAULT_LIMIT, COMMENTS_DEFAULT_PAGE } from '../constants';

@Injectable()
export class GetCommentsService {
  constructor(private readonly commentsRepository: CommentsRepository) {}

  async findEntityOrFail(id: string): Promise<CommentEntity> {
    const comment = await this.commentsRepository.findById(id);

    if (!comment) {
      throw new AppNotFoundException(
        ErrorCode.COMMENT_NOT_FOUND,
        'Comentário não encontrado',
      );
    }

    return comment;
  }

  async findAllPaginated(
    query: QueryCommentsDto,
  ): Promise<Paginated<CommentResponseDto>> {
    const page = query.page ?? COMMENTS_DEFAULT_PAGE;
    const limit = query.limit ?? COMMENTS_DEFAULT_LIMIT;

    const { items, total } =
      await this.commentsRepository.findAllPaginated(query);

    return new Paginated(items.map(toCommentResponse), total, page, limit);
  }

  /** Comentários publicados, para a página inicial. */
  async findPublished(): Promise<CommentResponseDto[]> {
    const items = await this.commentsRepository.findPublished();
    return items.map(toCommentResponse);
  }

  async findOne(id: string): Promise<CommentResponseDto> {
    return toCommentResponse(await this.findEntityOrFail(id));
  }

  /** Quantos comentários aguardam publicação, para o aviso do painel. */
  async countUnpublished(): Promise<{ unpublished: number }> {
    return { unpublished: await this.commentsRepository.countUnpublished() };
  }
}
