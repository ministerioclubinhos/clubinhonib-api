import { Injectable, Logger } from '@nestjs/common';
import { AppNotFoundException, ErrorCode } from 'src/shared/exceptions';
import { CreateCommentDto } from './dto/create-comment.dto';
import { CommentEntity } from './entity/comment.entity';
import { CommentRepository } from './repository/comment.repository';
import { UpdateCommentDto } from './dto/update-comment.dto';
import { NotificationService } from 'src/shared/providers/notification/notification.service';

@Injectable()
export class CommentService {
  private readonly logger = new Logger(CommentService.name);

  constructor(
    private readonly commentRepo: CommentRepository,
    private readonly notificationService: NotificationService,
  ) {}

  async create(dto: CreateCommentDto): Promise<CommentEntity> {
    this.logger.debug(`📝 Criando novo comentário`);
    const comment = this.commentRepo.create(dto);
    const saved = await this.commentRepo.save(comment);
    this.logger.log(`✅ Comentário salvo com ID: ${saved.id}`);

    await this.notificationService.notifyNewComment(saved);

    return saved;
  }

  async findAllPublished(): Promise<CommentEntity[]> {
    this.logger.debug('📄 Buscando comentários publicados');
    const comments = await this.commentRepo.findAllPublished();
    this.logger.log(
      `✅ Comentários publicados encontrados: ${comments.length}`,
    );
    return comments;
  }

  async findAll(): Promise<CommentEntity[]> {
    this.logger.debug('📄 Buscando todos os comentários');
    const comments = await this.commentRepo.findAll();
    this.logger.log(`✅ Total de comentários encontrados: ${comments.length}`);
    return comments;
  }

  async findOne(id: string): Promise<CommentEntity> {
    this.logger.debug(`🔍 Buscando comentário por ID: ${id}`);
    const comment = await this.commentRepo.findOneBy({ id });
    if (!comment) {
      this.logger.warn(`⚠️ Comentário não encontrado: ID=${id}`);
      throw new AppNotFoundException(
        ErrorCode.RESOURCE_NOT_FOUND,
        'Comentário não encontrado',
      );
    }
    this.logger.log(`✅ Comentário encontrado: ID=${comment.id}`);
    return comment;
  }

  async update(id: string, dto: UpdateCommentDto): Promise<CommentEntity> {
    this.logger.debug(`✏️ Atualizando comentário ID=${id}`);
    const comment = await this.findOne(id);
    Object.assign(comment, dto);
    const updated = await this.commentRepo.save(comment);
    this.logger.log(`✅ Comentário atualizado: ID=${updated.id}`);
    return updated;
  }

  async remove(id: string): Promise<void> {
    this.logger.debug(`🗑️ Removendo comentário ID=${id}`);
    const comment = await this.findOne(id);
    await this.commentRepo.remove(comment);
    this.logger.log(`✅ Comentário removido: ID=${id}`);
  }
}
