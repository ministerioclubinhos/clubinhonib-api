import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';
import { PhotoCommentNotificationEntity } from '../entities/photo-comment-notification.entity';
import { QueryPhotoCommentsDto } from '../dto/query-photo-comments.dto';
import { PhotoCommentOrder } from '../types';

@Injectable()
export class PhotoCommentNotificationsRepository {
  constructor(
    @InjectRepository(PhotoCommentNotificationEntity)
    private readonly repository: Repository<PhotoCommentNotificationEntity>,
  ) {}

  async findPage(
    recipientId: string,
    query: QueryPhotoCommentsDto,
  ): Promise<[PhotoCommentNotificationEntity[], number]> {
    return this.repository.findAndCount({
      where: { recipientId },
      order: { createdAt: PhotoCommentOrder.DESC, id: PhotoCommentOrder.DESC },
      skip: (query.page - 1) * query.limit,
      take: query.limit,
    });
  }

  async countUnread(recipientId: string): Promise<number> {
    return this.repository.countBy({ recipientId, readAt: IsNull() });
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
}
