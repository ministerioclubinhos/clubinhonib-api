import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { FindOptionsWhere, In, IsNull, Repository } from 'typeorm';
import { PhotoCommentNotificationEntity } from '../entities/photo-comment-notification.entity';
import { QueryPhotoCommentsDto } from '../dto/query-photo-comments.dto';
import {
  PhotoCommentNotificationAggregate,
  PhotoCommentNotificationPageQuery,
  PhotoCommentNotificationRecentRow,
  PhotoCommentOrder,
  RawNotificationAggregate,
} from '../types';
import {
  PHOTO_COMMENT_NOTIFICATION_READ_BATCH_SIZE,
  PHOTO_COMMENT_NOTIFICATION_RECENT_LIMIT,
} from '../constants';
import { chunkIds, toAggregate } from '../utils';

@Injectable()
export class PhotoCommentNotificationsRepository {
  constructor(
    @InjectRepository(PhotoCommentNotificationEntity)
    private readonly repository: Repository<PhotoCommentNotificationEntity>,
  ) {}

  async findPage(
    recipientId: string,
    query: QueryPhotoCommentsDto | PhotoCommentNotificationPageQuery,
  ): Promise<[PhotoCommentNotificationEntity[], number]> {
    const where: FindOptionsWhere<PhotoCommentNotificationEntity> = {
      recipientId,
    };
    if ('unreadOnly' in query && query.unreadOnly) where.readAt = IsNull();
    return this.repository.findAndCount({
      where,
      order: { createdAt: PhotoCommentOrder.DESC, id: PhotoCommentOrder.DESC },
      skip: (query.page - 1) * query.limit,
      take: query.limit,
    });
  }

  async findOwned(
    id: string,
    recipientId: string,
  ): Promise<PhotoCommentNotificationEntity | null> {
    return this.repository.findOneBy({ id, recipientId });
  }

  async countUnread(recipientId: string): Promise<number> {
    return this.repository.countBy({ recipientId, readAt: IsNull() });
  }

  /**
   * Agregados usados pela revisão do resumo: total, não lidos e a última
   * alteração. Leitura atualiza `updatedAt`; exclusão muda o total; criação
   * muda os três. Não carrega textos de comentário.
   */
  async aggregate(
    recipientId: string,
  ): Promise<PhotoCommentNotificationAggregate> {
    const raw = await this.repository
      .createQueryBuilder('notice')
      .select('COUNT(notice.id)', 'total')
      .addSelect(
        'SUM(CASE WHEN notice.readAt IS NULL THEN 1 ELSE 0 END)',
        'unreadCount',
      )
      .addSelect('MAX(notice.updatedAt)', 'lastChangedAt')
      .where('notice.recipientId = :recipientId', { recipientId })
      .getRawOne<RawNotificationAggregate>();
    return toAggregate(raw);
  }

  async findRecentUnread(
    recipientId: string,
  ): Promise<PhotoCommentNotificationRecentRow[]> {
    return this.repository.find({
      select: { id: true, createdAt: true },
      where: { recipientId, readAt: IsNull() },
      order: { createdAt: PhotoCommentOrder.DESC, id: PhotoCommentOrder.DESC },
      take: PHOTO_COMMENT_NOTIFICATION_RECENT_LIMIT,
    });
  }

  async markRead(
    id: string,
    recipientId: string,
  ): Promise<PhotoCommentNotificationEntity | null> {
    await this.repository.update(
      { id, recipientId, readAt: IsNull() },
      { readAt: new Date() },
    );
    return this.repository.findOneBy({ id, recipientId });
  }

  /**
   * Leitura em lote sobre um snapshot: os IDs não lidos do destinatário são
   * travados no início da transação e somente eles são atualizados. Avisos
   * inseridos depois do snapshot permanecem não lidos.
   */
  async markAllRead(recipientId: string): Promise<number> {
    return this.repository.manager.transaction(async (manager) => {
      const snapshot = await manager
        .createQueryBuilder(PhotoCommentNotificationEntity, 'notice')
        .select('notice.id', 'id')
        .where('notice.recipientId = :recipientId', { recipientId })
        .andWhere('notice.readAt IS NULL')
        .setLock('pessimistic_write')
        .getRawMany<{ id: string }>();
      const readAt = new Date();
      let updated = 0;
      for (const ids of chunkIds(
        snapshot.map((row) => row.id),
        PHOTO_COMMENT_NOTIFICATION_READ_BATCH_SIZE,
      )) {
        const result = await manager.update(
          PhotoCommentNotificationEntity,
          { id: In(ids), recipientId, readAt: IsNull() },
          { readAt },
        );
        updated += result.affected ?? 0;
      }
      return updated;
    });
  }
}
