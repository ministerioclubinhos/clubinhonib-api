import { ValidationPipe } from '@nestjs/common';
import { GUARDS_METADATA } from '@nestjs/common/constants';
import { JwtAuthGuard } from 'src/core/auth/guards/jwt-auth.guard';
import { AdminRoleGuard } from 'src/core/auth/guards/role-guard';
import { FeedPhotoCommentsController } from '../feed-photo-comments.controller';
import { PhotoCommentStatus } from '../types';
import { CreatePhotoCommentDto } from './create-photo-comment.dto';
import { ModeratePhotoCommentDto } from './moderate-photo-comment.dto';
import {
  QueryPhotoCommentModerationDto,
  QueryPhotoCommentsDto,
} from './query-photo-comments.dto';

const pipe = new ValidationPipe({
  transform: true,
  whitelist: true,
  forbidNonWhitelisted: true,
});
const requestId = '33333333-3333-4333-8333-333333333333';
const create = (body: unknown) =>
  pipe.transform(body, { type: 'body', metatype: CreatePhotoCommentDto });

describe('Photo comment HTTP contracts', () => {
  it('trims comments and accepts the documented maximum', async () => {
    expect(await create({ text: '  Olá!  ', requestId })).toEqual({
      text: 'Olá!',
      requestId,
    });
    await expect(
      create({ text: 'a'.repeat(1000), requestId }),
    ).resolves.toBeDefined();
  });
  it.each(['', '   ', 'a'.repeat(1001), null, 12])(
    'rejects empty, oversized and non-text content (%#)',
    async (text) => {
      await expect(create({ text, requestId })).rejects.toThrow();
    },
  );
  it('requires an idempotency UUID', async () => {
    await expect(
      create({ text: 'Olá', requestId: 'invalid' }),
    ).rejects.toThrow();
    await expect(create({ text: 'Olá' })).rejects.toThrow();
  });
  it.each(['status', 'authorId', 'moderatedById', 'published', 'mediaId'])(
    'refuses client-controlled %s on submission',
    async (field) => {
      await expect(
        create({ text: 'Olá', requestId, [field]: 'injected' }),
      ).rejects.toThrow();
    },
  );
  it('uses bounded pagination and rejects status injection on the public endpoint', async () => {
    const transform = (query: unknown) =>
      pipe.transform(query, { type: 'query', metatype: QueryPhotoCommentsDto });
    expect(await transform({})).toEqual({ page: 1, limit: 10 });
    expect(await transform({ page: '2', limit: '50' })).toEqual({
      page: 2,
      limit: 50,
    });
    for (const query of [
      { page: 0 },
      { page: 1.5 },
      { limit: 51 },
      { limit: -1 },
      { status: 'pending' },
    ]) {
      await expect(transform(query)).rejects.toThrow();
    }
  });
  it('validates moderation filters', async () => {
    const transform = (query: unknown) =>
      pipe.transform(query, {
        type: 'query',
        metatype: QueryPhotoCommentModerationDto,
      });
    expect(
      await transform({
        status: PhotoCommentStatus.PENDING,
        searchString: '  autor  ',
      }),
    ).toMatchObject({ searchString: 'autor' });
    await expect(transform({ status: 'unknown' })).rejects.toThrow();
    await expect(
      transform({ searchString: 'x'.repeat(201) }),
    ).rejects.toThrow();
  });
  it('requires a version and an explicit moderation decision', async () => {
    const transform = (body: unknown) =>
      pipe.transform(body, { type: 'body', metatype: ModeratePhotoCommentDto });
    expect(
      await transform({
        status: PhotoCommentStatus.REJECTED,
        expectedVersion: 1,
        reason: '  Ajuste o texto  ',
      }),
    ).toMatchObject({ reason: 'Ajuste o texto' });
    for (const body of [
      ...[undefined, '', '  ', null].map((reason) => ({
        status: PhotoCommentStatus.REJECTED,
        expectedVersion: 1,
        reason,
      })),
      { status: PhotoCommentStatus.PENDING, expectedVersion: 1 },
      { status: PhotoCommentStatus.APPROVED },
      { status: PhotoCommentStatus.APPROVED, expectedVersion: 0 },
      {
        status: PhotoCommentStatus.REJECTED,
        expectedVersion: 1,
        reason: 'x'.repeat(501),
      },
    ])
      await expect(transform(body)).rejects.toThrow();
  });
  it.each([
    'create',
    'mine',
    'remove',
    'notifications',
    'readNotification',
  ] as const)('protects %s with authentication', (method) => {
    expect(
      Reflect.getMetadata(
        GUARDS_METADATA,
        FeedPhotoCommentsController.prototype[method],
      ),
    ).toContain(JwtAuthGuard);
  });
  it.each(['moderate', 'moderation'] as const)(
    'protects %s with both authentication and admin authorization',
    (method) => {
      expect(
        Reflect.getMetadata(
          GUARDS_METADATA,
          FeedPhotoCommentsController.prototype[method],
        ),
      ).toEqual([JwtAuthGuard, AdminRoleGuard]);
    },
  );
});
