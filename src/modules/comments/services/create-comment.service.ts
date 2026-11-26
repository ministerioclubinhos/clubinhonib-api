import { Injectable, Logger } from '@nestjs/common';

import { NotificationService } from 'src/shared/providers/notification/notification.service';

import { CommentsRepository } from '../repositories/comments.repository';
import { CreateCommentDto } from '../dto/create-comment.dto';
import { CommentResponseDto } from '../dto/comment-response.dto';
import { toCommentResponse } from '../mappers';

@Injectable()
export class CreateCommentService {
  private readonly logger = new Logger(CreateCommentService.name);

  constructor(
    private readonly commentsRepository: CommentsRepository,
    private readonly notificationService: NotificationService,
  ) {}

  async create(dto: CreateCommentDto): Promise<CommentResponseDto> {
    // Nasce sem publicação: quem publica é a administração.
    const comment = await this.commentsRepository.createOne({
      ...dto,
      published: false,
    });

    this.logger.log(`Comentário criado. ID=${comment.id}`);

    // O aviso aos administradores nunca derruba o envio: o comentário já está
    // salvo e aparece no painel aguardando publicação.
    await this.notificationService.notifyNewComment(comment);

    return toCommentResponse(comment);
  }
}
