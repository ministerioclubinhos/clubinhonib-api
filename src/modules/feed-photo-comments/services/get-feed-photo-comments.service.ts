import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AccessContext, UserRole } from 'src/core/auth/auth.types';
import { GetUsersService } from 'src/core/user/services/get-user.service';
import { FeatureFlagKeys } from 'src/core/feature-flags/enums/feature-flag-keys.enum';
import { GetFeatureFlagsService } from 'src/core/feature-flags/services/get-feature-flags.service';
import { ImagePageGetService } from 'src/modules/pages/image-page/services/get-image-page.service';
import { FeedPhotoContextDto } from 'src/modules/pages/image-page/dto/feed-photo-context.dto';
import { Paginated } from 'src/shared/dto/paginated.dto';
import {
  AppForbiddenException,
  AppNotFoundException,
  AppUnauthorizedException,
  ErrorCode,
} from 'src/shared/exceptions';
import { FeedPhotoCommentsRepository } from '../repositories/feed-photo-comments.repository';
import { PhotoCommentActor } from '../types';
import {
  AdminPhotoCommentResponseDto,
  OwnPhotoCommentResponseDto,
  PhotoCommentResponseDto,
} from '../dto/photo-comment-response.dto';
import {
  QueryPhotoCommentModerationDto,
  QueryPhotoCommentsDto,
} from '../dto/query-photo-comments.dto';
import { toOwnPhotoComment, toPublicPhotoComment } from '../utils';

@Injectable()
export class GetFeedPhotoCommentsService {
  constructor(
    private readonly repository: FeedPhotoCommentsRepository,
    private readonly users: GetUsersService,
    private readonly images: ImagePageGetService,
    private readonly flags: GetFeatureFlagsService,
    private readonly config: ConfigService,
  ) {}

  async requireActiveActor(userId: string | null): Promise<PhotoCommentActor> {
    if (!userId)
      throw new AppUnauthorizedException(
        ErrorCode.TOKEN_MISSING,
        'Entre na sua conta para comentar.',
      );
    const user = await this.users.findOne(userId);
    if (!user.active)
      throw new AppForbiddenException(
        ErrorCode.USER_INACTIVE,
        'Sua conta precisa estar ativa para comentar.',
      );
    return { userId: user.id, name: user.name, role: user.role };
  }

  async requireAdmin(userId: string): Promise<PhotoCommentActor> {
    const actor = await this.requireActiveActor(userId);
    if (actor.role !== UserRole.ADMIN)
      throw new AppForbiddenException(
        ErrorCode.ROLE_NOT_ALLOWED,
        'Apenas administradores podem moderar comentários.',
      );
    await this.requireFeature(FeatureFlagKeys.COMMENT_MODERATION, actor.role);
    return actor;
  }

  async requireFeature(key: FeatureFlagKeys, role?: UserRole): Promise<void> {
    if (!(await this.flags.isEnabled(key, role)))
      throw new AppForbiddenException(
        ErrorCode.FEATURE_DISABLED,
        'Este recurso está temporariamente indisponível.',
      );
  }

  feedPageId(): string {
    const id = this.config.get<string>('FEED_CLUBINHO_PAGE_ID');
    if (!id)
      throw new AppNotFoundException(
        ErrorCode.RESOURCE_NOT_FOUND,
        'Feed indisponível.',
      );
    return id;
  }

  async requirePhoto(
    mediaId: string,
    actor: PhotoCommentActor | null,
  ): Promise<FeedPhotoContextDto> {
    await this.requireFeature(FeatureFlagKeys.CLUBINHO_FEED, actor?.role);
    const photo = await this.images.findFeedPhotoContext(
      mediaId,
      this.feedPageId(),
    );
    if (!photo || (!actor && (!photo.pagePublic || !photo.sectionPublic))) {
      throw new AppNotFoundException(
        ErrorCode.MEDIA_NOT_FOUND,
        'Foto ou vídeo não encontrado.',
      );
    }
    return photo;
  }

  async findPublished(
    mediaId: string,
    query: QueryPhotoCommentsDto,
    access: AccessContext,
  ): Promise<Paginated<PhotoCommentResponseDto>> {
    const actor = access.userId
      ? await this.requireActiveActor(access.userId)
      : null;
    await this.requirePhoto(mediaId, actor);
    const [rows, total] = await this.repository.findVisible(mediaId, query);
    return new Paginated(
      rows.map(toPublicPhotoComment),
      total,
      query.page,
      query.limit,
    );
  }

  async findMine(
    mediaId: string,
    query: QueryPhotoCommentsDto,
    userId: string,
  ): Promise<Paginated<OwnPhotoCommentResponseDto>> {
    const actor = await this.requireActiveActor(userId);
    await this.requirePhoto(mediaId, actor);
    const [rows, total] = await this.repository.findVisible(
      mediaId,
      query,
      actor.userId,
    );
    return new Paginated(
      rows.map(toOwnPhotoComment),
      total,
      query.page,
      query.limit,
    );
  }

  async findModeration(
    query: QueryPhotoCommentModerationDto,
    userId: string,
  ): Promise<Paginated<AdminPhotoCommentResponseDto>> {
    const actor = await this.requireAdmin(userId);
    await this.requireFeature(FeatureFlagKeys.CLUBINHO_FEED, actor.role);
    const [rows, total] = await this.repository.findModeration(
      this.feedPageId(),
      query,
    );
    return new Paginated(rows, total, query.page, query.limit);
  }
}
