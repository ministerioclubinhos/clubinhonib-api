import { CreatePhotoCommentRejectionEmailService } from './create-photo-comment-rejection-email.service';
import { EntityManager } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { UserRole } from 'src/core/auth/auth.types';
import { GetUsersService } from 'src/core/user/services/get-user.service';
import { GetFeatureFlagsService } from 'src/core/feature-flags/services/get-feature-flags.service';
import { ImagePageGetService } from 'src/modules/pages/image-page/services/get-image-page.service';
import { ErrorCode } from 'src/shared/exceptions';
import { FeedPhotoCommentsRepository } from '../repositories/feed-photo-comments.repository';
import { PhotoCommentStatus } from '../types';
import { FeedPhotoCommentEntity } from '../entities/feed-photo-comment.entity';
import { PHOTO_COMMENT_RATE_LIMIT } from '../constants';
import { GetFeedPhotoCommentsService } from './get-feed-photo-comments.service';
import { CreateFeedPhotoCommentService } from './create-feed-photo-comment.service';
import { UpdateFeedPhotoCommentService } from './update-feed-photo-comment.service';
import { DeleteFeedPhotoCommentService } from './delete-feed-photo-comment.service';

const actorId = '11111111-1111-4111-8111-111111111111';
const photoId = '22222222-2222-4222-8222-222222222222';
const requestId = '33333333-3333-4333-8333-333333333333';
const query = { page: 1, limit: 10 };

function fixture(): FeedPhotoCommentEntity {
  return Object.assign(new FeedPhotoCommentEntity(), {
    id: 'comment-id',
    mediaId: photoId,
    authorId: actorId,
    requestId,
    text: 'Um encontro especial!',
    status: PhotoCommentStatus.PENDING,
    version: 1,
    moderationReason: null,
    moderatedById: null,
    reviewedAt: null,
    createdAt: new Date('2026-11-02T12:00:00Z'),
    updatedAt: new Date('2026-11-02T12:00:00Z'),
    author: {
      id: actorId,
      name: 'Autora',
      email: 'private@example.test',
      password: 'never-expose',
    },
  });
}

describe('Feed photo comments use cases', () => {
  const repo = {
    withAuthorLock: jest.fn(),
    findRequest: jest.fn(),
    countRecent: jest.fn(),
    createPending: jest.fn(),
    findById: jest.fn(),
    findVisible: jest.fn(),
    findModeration: jest.fn(),
    moderate: jest.fn(),
    delete: jest.fn(),
  };
  const email = { sendInBackground: jest.fn() };
  const users = { findOne: jest.fn() };
  const images = { findFeedPhotoContext: jest.fn() };
  const flags = { isEnabled: jest.fn() };
  const config = { get: jest.fn() };
  let get: GetFeedPhotoCommentsService;
  let create: CreateFeedPhotoCommentService;
  let update: UpdateFeedPhotoCommentService;
  let remove: DeleteFeedPhotoCommentService;

  beforeEach(() => {
    jest.resetAllMocks();
    users.findOne.mockResolvedValue({
      id: actorId,
      name: 'Autora',
      active: true,
      role: UserRole.TEACHER,
    });
    images.findFeedPhotoContext.mockResolvedValue({
      mediaId: photoId,
      pageId: 'feed-page',
      sectionPublic: true,
      pagePublic: true,
    });
    flags.isEnabled.mockResolvedValue(true);
    config.get.mockReturnValue('feed-page');
    repo.withAuthorLock.mockImplementation(
      (_id: string, work: (manager: EntityManager) => Promise<unknown>) =>
        work({} as EntityManager),
    );
    repo.findRequest.mockResolvedValue(null);
    repo.countRecent.mockResolvedValue(0);
    repo.createPending.mockResolvedValue(fixture());
    repo.findById.mockResolvedValue(fixture());
    repo.findVisible.mockResolvedValue([[fixture()], 1]);
    repo.findModeration.mockResolvedValue([[], 0]);
    repo.moderate.mockResolvedValue(true);
    get = new GetFeedPhotoCommentsService(
      repo as unknown as FeedPhotoCommentsRepository,
      users as unknown as GetUsersService,
      images as unknown as ImagePageGetService,
      flags as unknown as GetFeatureFlagsService,
      config as unknown as ConfigService,
    );
    create = new CreateFeedPhotoCommentService(
      repo as unknown as FeedPhotoCommentsRepository,
      get,
    );
    update = new UpdateFeedPhotoCommentService(
      repo as unknown as FeedPhotoCommentsRepository,
      get,
      email as unknown as CreatePhotoCommentRejectionEmailService,
    );
    remove = new DeleteFeedPhotoCommentService(
      repo as unknown as FeedPhotoCommentsRepository,
      get,
    );
  });

  it('creates pending comments with the authenticated identity and a safe response', async () => {
    const result = await create.create(
      photoId,
      { text: fixture().text, requestId },
      actorId,
    );
    expect(result.status).toBe(PhotoCommentStatus.PENDING);
    expect(repo.createPending).toHaveBeenCalledWith(
      actorId,
      photoId,
      fixture().text,
      requestId,
      expect.anything(),
    );
    expect(result).not.toHaveProperty('author');
    expect(result).not.toHaveProperty('email');
    expect(result).not.toHaveProperty('moderatedById');
  });
  it('requires an authenticated actor', async () => {
    await expect(get.requireActiveActor(null)).rejects.toMatchObject({
      code: ErrorCode.TOKEN_MISSING,
    });
  });
  it.each([UserRole.TEACHER, UserRole.ADMIN])(
    'refuses inactive %s even with a valid token',
    async (role) => {
      users.findOne.mockResolvedValue({ id: actorId, role, active: false });
      await expect(
        create.create(photoId, { text: 'Comentário', requestId }, actorId),
      ).rejects.toMatchObject({ code: ErrorCode.USER_INACTIVE });
      expect(repo.createPending).not.toHaveBeenCalled();
    },
  );
  it('even administrator submissions start pending', async () => {
    users.findOne.mockResolvedValue({
      id: actorId,
      role: UserRole.ADMIN,
      active: true,
    });
    expect(
      (
        await create.create(
          photoId,
          { text: fixture().text, requestId },
          actorId,
        )
      ).status,
    ).toBe(PhotoCommentStatus.PENDING);
  });
  it('refuses disabled features', async () => {
    flags.isEnabled.mockResolvedValue(false);
    await expect(
      create.create(photoId, { text: 'x', requestId }, actorId),
    ).rejects.toMatchObject({ code: ErrorCode.FEATURE_DISABLED });
  });
  it('does not accept media outside the configured feed or non-images', async () => {
    images.findFeedPhotoContext.mockResolvedValue(null);
    await expect(
      create.create(photoId, { text: 'x', requestId }, actorId),
    ).rejects.toMatchObject({ code: ErrorCode.MEDIA_NOT_FOUND });
    expect(images.findFeedPhotoContext).toHaveBeenCalledWith(
      photoId,
      'feed-page',
    );
  });
  it('fails closed when no feed is configured', async () => {
    config.get.mockReturnValue(undefined);
    await expect(
      get.findPublished(photoId, query, { userId: null }),
    ).rejects.toMatchObject({ code: ErrorCode.RESOURCE_NOT_FOUND });
  });
  it.each([
    { pagePublic: false, sectionPublic: true },
    { pagePublic: true, sectionPublic: false },
  ])(
    'does not expose private photo comments to anonymous readers: %o',
    async (visibility) => {
      images.findFeedPhotoContext.mockResolvedValue(visibility);
      await expect(
        get.findPublished(photoId, query, { userId: null }),
      ).rejects.toMatchObject({ code: ErrorCode.MEDIA_NOT_FOUND });
      expect(repo.findVisible).not.toHaveBeenCalled();
    },
  );
  it('allows active users to read approved comments on team photos', async () => {
    images.findFeedPhotoContext.mockResolvedValue({
      pagePublic: false,
      sectionPublic: false,
    });
    await get.findPublished(photoId, query, { userId: actorId });
    expect(repo.findVisible).toHaveBeenCalledWith(photoId, query);
  });
  it('public DTOs never contain private moderation metadata', async () => {
    const result = await get.findPublished(photoId, query, { userId: null });
    expect(Object.keys(result.data[0]).sort()).toEqual([
      'authorName',
      'createdAt',
      'id',
      'mediaId',
      'text',
    ]);
    expect(result).toMatchObject({
      page: 1,
      limit: 10,
      total: 1,
      pageCount: 1,
    });
  });
  it('only reads the authenticated author’s submission history', async () => {
    const result = await get.findMine(photoId, query, actorId);
    expect(repo.findVisible).toHaveBeenCalledWith(photoId, query, actorId);
    expect(result.data[0].status).toBe(PhotoCommentStatus.PENDING);
  });
  it('retries the same request without duplicating the comment or consuming rate limits', async () => {
    repo.findRequest.mockResolvedValue(fixture());
    const result = await create.create(
      photoId,
      { text: fixture().text, requestId },
      actorId,
    );
    expect(result.id).toBe('comment-id');
    expect(repo.createPending).not.toHaveBeenCalled();
    expect(repo.countRecent).not.toHaveBeenCalled();
  });
  it.each([
    { text: 'Outro texto', mediaId: photoId },
    { text: 'Um encontro especial!', mediaId: 'other-photo' },
  ])('refuses request-key reuse with different content: %o', async (input) => {
    repo.findRequest.mockResolvedValue(fixture());
    await expect(
      create.create(input.mediaId, { text: input.text, requestId }, actorId),
    ).rejects.toMatchObject({ code: ErrorCode.RESOURCE_CONFLICT });
  });
  it('limits repeated submissions under the author lock', async () => {
    repo.countRecent.mockResolvedValue(PHOTO_COMMENT_RATE_LIMIT);
    await expect(
      create.create(photoId, { text: 'x', requestId }, actorId),
    ).rejects.toMatchObject({ code: ErrorCode.RESOURCE_CONFLICT });
    expect(repo.createPending).not.toHaveBeenCalled();
  });
  it.each([UserRole.TEACHER, UserRole.COORDINATOR])(
    'denies moderation to a current %s regardless of an old JWT role',
    async (role) => {
      users.findOne.mockResolvedValue({ id: actorId, role, active: true });
      await expect(
        update.moderate(
          'comment-id',
          { status: PhotoCommentStatus.APPROVED, expectedVersion: 1 },
          actorId,
        ),
      ).rejects.toMatchObject({ code: ErrorCode.ROLE_NOT_ALLOWED });
      expect(repo.moderate).not.toHaveBeenCalled();
    },
  );
  it('approves using a conditional versioned write', async () => {
    users.findOne.mockResolvedValue({
      id: actorId,
      role: UserRole.ADMIN,
      active: true,
    });
    const dto = {
      status: PhotoCommentStatus.APPROVED as const,
      expectedVersion: 1,
    };
    await update.moderate('comment-id', dto, actorId);
    expect(repo.moderate).toHaveBeenCalledWith(
      'comment-id',
      actorId,
      dto,
      undefined,
    );
    expect(email.sendInBackground).not.toHaveBeenCalled();
  });
  it('does not overwrite a concurrent administrator’s decision', async () => {
    users.findOne.mockResolvedValue({
      id: actorId,
      role: UserRole.ADMIN,
      active: true,
    });
    repo.moderate.mockResolvedValue(false);
    await expect(
      update.moderate(
        'comment-id',
        {
          status: PhotoCommentStatus.REJECTED,
          expectedVersion: 1,
          reason: 'Motivo',
        },
        actorId,
      ),
    ).rejects.toMatchObject({ code: ErrorCode.RESOURCE_CONFLICT });
  });
  it('snapshots the reason and author atomically, then sends email only after commit', async () => {
    users.findOne.mockResolvedValue({
      id: actorId,
      role: UserRole.ADMIN,
      active: true,
    });
    await update.moderate(
      'comment-id',
      {
        status: PhotoCommentStatus.REJECTED,
        expectedVersion: 1,
        reason: '  Dados pessoais  ',
      },
      actorId,
    );
    const notice = {
      recipientId: actorId,
      commentId: 'comment-id',
      commentVersion: 2,
      commentText: fixture().text,
      reason: 'Dados pessoais',
    };
    expect(repo.moderate).toHaveBeenCalledWith(
      'comment-id',
      actorId,
      expect.any(Object),
      notice,
    );
    expect(email.sendInBackground).toHaveBeenCalledWith(
      fixture().author,
      notice,
    );
    expect(repo.moderate.mock.invocationCallOrder[0]).toBeLessThan(
      email.sendInBackground.mock.invocationCallOrder[0],
    );
  });
  it.each([undefined, '', '   '])(
    'requires a nonblank rejection reason (%#)',
    async (reason) => {
      users.findOne.mockResolvedValue({
        id: actorId,
        role: UserRole.ADMIN,
        active: true,
      });
      await expect(
        update.moderate(
          'comment-id',
          { status: PhotoCommentStatus.REJECTED, expectedVersion: 1, reason },
          actorId,
        ),
      ).rejects.toMatchObject({ code: ErrorCode.VALIDATION_ERROR });
      expect(repo.moderate).not.toHaveBeenCalled();
      expect(email.sendInBackground).not.toHaveBeenCalled();
    },
  );
  it('does not notify again on a repeated rejection', async () => {
    users.findOne.mockResolvedValue({
      id: actorId,
      role: UserRole.ADMIN,
      active: true,
    });
    repo.findById.mockResolvedValue({
      ...fixture(),
      status: PhotoCommentStatus.REJECTED,
      version: 2,
    });
    await expect(
      update.moderate(
        'comment-id',
        {
          status: PhotoCommentStatus.REJECTED,
          expectedVersion: 2,
          reason: 'Motivo',
        },
        actorId,
      ),
    ).rejects.toMatchObject({ code: ErrorCode.RESOURCE_CONFLICT });
    expect(repo.moderate).not.toHaveBeenCalled();
    expect(email.sendInBackground).not.toHaveBeenCalled();
  });
  it('never sends email when the transaction fails', async () => {
    users.findOne.mockResolvedValue({
      id: actorId,
      role: UserRole.ADMIN,
      active: true,
    });
    repo.moderate.mockRejectedValue(new Error('rollback'));
    await expect(
      update.moderate(
        'comment-id',
        {
          status: PhotoCommentStatus.REJECTED,
          expectedVersion: 1,
          reason: 'Motivo',
        },
        actorId,
      ),
    ).rejects.toThrow('rollback');
    expect(email.sendInBackground).not.toHaveBeenCalled();
  });
  it('requires an existing comment to moderate', async () => {
    users.findOne.mockResolvedValue({
      id: actorId,
      role: UserRole.ADMIN,
      active: true,
    });
    repo.findById.mockResolvedValue(null);
    await expect(
      update.moderate(
        'missing',
        { status: PhotoCommentStatus.APPROVED, expectedVersion: 1 },
        actorId,
      ),
    ).rejects.toMatchObject({ code: ErrorCode.COMMENT_NOT_FOUND });
  });
  it('handles concurrent deletion after a moderation update', async () => {
    users.findOne.mockResolvedValue({
      id: actorId,
      role: UserRole.ADMIN,
      active: true,
    });
    repo.findById.mockResolvedValueOnce(fixture()).mockResolvedValueOnce(null);
    await expect(
      update.moderate(
        'comment-id',
        { status: PhotoCommentStatus.APPROVED, expectedVersion: 1 },
        actorId,
      ),
    ).rejects.toMatchObject({ code: ErrorCode.COMMENT_NOT_FOUND });
  });
  it('lists moderation only for active administrators and the configured feed', async () => {
    users.findOne.mockResolvedValue({
      id: actorId,
      role: UserRole.ADMIN,
      active: true,
    });
    await get.findModeration(
      { ...query, status: PhotoCommentStatus.PENDING },
      actorId,
    );
    expect(repo.findModeration).toHaveBeenCalledWith('feed-page', {
      ...query,
      status: PhotoCommentStatus.PENDING,
    });
  });
  it('also respects a disabled feed on the moderation list', async () => {
    users.findOne.mockResolvedValue({
      id: actorId,
      role: UserRole.ADMIN,
      active: true,
    });
    flags.isEnabled.mockResolvedValueOnce(true).mockResolvedValueOnce(false);
    await expect(get.findModeration(query, actorId)).rejects.toMatchObject({
      code: ErrorCode.FEATURE_DISABLED,
    });
    expect(repo.findModeration).not.toHaveBeenCalled();
  });
  it('allows an author to remove their own comment', async () => {
    expect(await remove.remove('comment-id', actorId)).toEqual({
      message: 'Comentário excluído.',
    });
    expect(repo.delete).toHaveBeenCalledWith('comment-id');
  });
  it('does not reveal or delete another author’s comment', async () => {
    repo.findById.mockResolvedValue({ ...fixture(), authorId: 'someone-else' });
    await expect(remove.remove('comment-id', actorId)).rejects.toMatchObject({
      code: ErrorCode.COMMENT_NOT_FOUND,
    });
    expect(repo.delete).not.toHaveBeenCalled();
  });
  it('returns not found when removing an absent comment', async () => {
    repo.findById.mockResolvedValue(null);
    await expect(remove.remove('missing', actorId)).rejects.toMatchObject({
      code: ErrorCode.COMMENT_NOT_FOUND,
    });
  });
  it('allows an active admin to remove a comment from another author', async () => {
    users.findOne.mockResolvedValue({
      id: actorId,
      role: UserRole.ADMIN,
      active: true,
    });
    repo.findById.mockResolvedValue({ ...fixture(), authorId: 'someone-else' });
    await remove.remove('comment-id', actorId);
    expect(repo.delete).toHaveBeenCalled();
  });
});
