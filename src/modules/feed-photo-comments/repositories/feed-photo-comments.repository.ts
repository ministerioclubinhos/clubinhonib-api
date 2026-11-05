import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import {
  Brackets,
  DataSource,
  EntityManager,
  MoreThanOrEqual,
  Repository,
} from 'typeorm';
import { UserEntity } from 'src/core/user/entities/user.entity';
import { ImageSectionEntity } from 'src/modules/pages/image-page/entity/Image-section.entity';
import { IMAGE_PAGE_ENTITY_TYPE } from 'src/modules/pages/image-page/constants';
import { FeedPhotoCommentEntity } from '../entities/feed-photo-comment.entity';
import {
  QueryPhotoCommentModerationDto,
  QueryPhotoCommentsDto,
} from '../dto/query-photo-comments.dto';
import {
  PhotoCommentOrder,
  PhotoCommentStatus,
  CreatePhotoCommentNotificationInput,
} from '../types';
import { PhotoCommentNotificationEntity } from '../entities/photo-comment-notification.entity';
import { AdminPhotoCommentResponseDto } from '../dto/photo-comment-response.dto';
import { ModeratePhotoCommentDto } from '../dto/moderate-photo-comment.dto';

@Injectable()
export class FeedPhotoCommentsRepository {
  constructor(
    @InjectRepository(FeedPhotoCommentEntity)
    private readonly repository: Repository<FeedPhotoCommentEntity>,
    private readonly dataSource: DataSource,
  ) {}

  /** A per-author lock serializes retries and submission limits across API instances. */
  async withAuthorLock<T>(
    authorId: string,
    work: (manager: EntityManager) => Promise<T>,
  ): Promise<T> {
    return this.dataSource.transaction(async (manager) => {
      await manager.getRepository(UserEntity).findOne({
        where: { id: authorId },
        lock: { mode: 'pessimistic_write' },
      });
      return work(manager);
    });
  }

  async findRequest(
    authorId: string,
    requestId: string,
    manager: EntityManager,
  ): Promise<FeedPhotoCommentEntity | null> {
    return manager
      .getRepository(FeedPhotoCommentEntity)
      .findOne({ where: { authorId, requestId }, relations: { author: true } });
  }

  async countRecent(
    authorId: string,
    since: Date,
    manager: EntityManager,
  ): Promise<number> {
    return manager
      .getRepository(FeedPhotoCommentEntity)
      .countBy({ authorId, createdAt: MoreThanOrEqual(since) });
  }

  async createPending(
    authorId: string,
    mediaId: string,
    text: string,
    requestId: string,
    manager: EntityManager,
  ): Promise<FeedPhotoCommentEntity> {
    const repository = manager.getRepository(FeedPhotoCommentEntity);
    const saved = await repository.save(
      repository.create({
        authorId,
        mediaId,
        text,
        requestId,
        status: PhotoCommentStatus.PENDING,
        moderationReason: null,
        moderatedById: null,
        reviewedAt: null,
      }),
    );
    return repository.findOneOrFail({
      where: { id: saved.id },
      relations: { author: true },
    });
  }

  async findById(id: string): Promise<FeedPhotoCommentEntity | null> {
    return this.repository.findOne({
      where: { id },
      relations: { author: true },
    });
  }

  async findVisible(
    mediaId: string,
    query: QueryPhotoCommentsDto,
    authorId?: string,
  ): Promise<[FeedPhotoCommentEntity[], number]> {
    return this.repository.findAndCount({
      where: {
        mediaId,
        ...(authorId ? { authorId } : { status: PhotoCommentStatus.APPROVED }),
      },
      select: {
        id: true,
        mediaId: true,
        text: true,
        createdAt: true,
        status: true,
        version: true,
        moderationReason: true,
        author: { name: true },
      },
      relations: { author: true },
      order: { createdAt: PhotoCommentOrder.DESC, id: PhotoCommentOrder.DESC },
      skip: (query.page - 1) * query.limit,
      take: query.limit,
    });
  }

  async findModeration(
    pageId: string,
    query: QueryPhotoCommentModerationDto,
  ): Promise<[AdminPhotoCommentResponseDto[], number]> {
    const qb = this.repository
      .createQueryBuilder('comment')
      .innerJoin('comment.author', 'author')
      .innerJoin('comment.media', 'media')
      .innerJoin(ImageSectionEntity, 'section', 'section.id = media.targetId')
      .leftJoin('comment.moderatedBy', 'moderator')
      .where('section.pageId = :pageId AND media.targetType = :targetType', {
        pageId,
        targetType: IMAGE_PAGE_ENTITY_TYPE,
      });
    if (query.status)
      qb.andWhere('comment.status = :status', { status: query.status });
    if (query.searchString)
      qb.andWhere(
        new Brackets((search) => {
          search
            .where('author.name LIKE :search')
            .orWhere('comment.text LIKE :search')
            .orWhere('section.caption LIKE :search');
        }),
        { search: `%${query.searchString}%` },
      );
    const total = await qb.getCount();
    const rows = await qb
      .select('comment.id', 'id')
      .addSelect('comment.mediaId', 'mediaId')
      .addSelect('comment.authorId', 'authorId')
      .addSelect('comment.text', 'text')
      .addSelect('author.name', 'authorName')
      .addSelect('comment.status', 'status')
      .addSelect('comment.version', 'version')
      .addSelect('comment.moderationReason', 'moderationReason')
      .addSelect('comment.createdAt', 'createdAt')
      .addSelect('comment.reviewedAt', 'reviewedAt')
      .addSelect('moderator.name', 'moderatedByName')
      .addSelect('media.url', 'photoUrl')
      .addSelect('media.uploadType', 'photoUploadType')
      .addSelect('media.platformType', 'photoPlatformType')
      .addSelect('media.title', 'photoTitle')
      .addSelect('section.id', 'sectionId')
      .addSelect('section.caption', 'sectionCaption')
      .orderBy('comment.createdAt', PhotoCommentOrder.DESC)
      .addOrderBy('comment.id', PhotoCommentOrder.DESC)
      .offset((query.page - 1) * query.limit)
      .limit(query.limit)
      .getRawMany<AdminPhotoCommentResponseDto>();
    return [rows, total];
  }

  async moderate(
    id: string,
    actorId: string,
    dto: ModeratePhotoCommentDto,
    notification?: CreatePhotoCommentNotificationInput,
  ): Promise<boolean> {
    return this.dataSource.transaction(async (manager) => {
      const result = await manager.getRepository(FeedPhotoCommentEntity).update(
        { id, version: dto.expectedVersion },
        {
          status: dto.status,
          moderationReason:
            dto.status === PhotoCommentStatus.REJECTED
              ? dto.reason || null
              : null,
          moderatedById: actorId,
          reviewedAt: new Date(),
        },
      );
      if (result.affected !== 1) return false;
      if (notification) {
        const notices = manager.getRepository(PhotoCommentNotificationEntity);
        await notices.save(notices.create({ ...notification, readAt: null }));
      }
      return true;
    });
  }

  async delete(id: string): Promise<void> {
    await this.repository.delete(id);
  }
}
