import { Test } from '@nestjs/testing';
import { DataSource, EntityManager } from 'typeorm';
import {
  AppInternalException,
  AppNotFoundException,
} from 'src/shared/exceptions';
import { AwsS3Service } from 'src/shared/providers/aws/aws-s3.service';
import { MediaItemProcessor } from 'src/shared/media/media-item-processor';
import {
  MediaItemEntity,
  MediaType,
  UploadType,
} from 'src/shared/media/media-item/media-item.entity';
import { EventRepository } from '../event.repository';
import { EventEntity } from '../entities/event.entity';
import { UpdateEventService } from './update-event-service';

const storedMedia = Object.assign(new MediaItemEntity(), {
  id: 'media-1',
  url: 'https://s3/antiga.png',
  isLocalFile: true,
  targetId: 'event-1',
  targetType: 'Event',
});

const buildEvent = (): EventEntity =>
  Object.assign(new EventEntity(), {
    id: 'event-1',
    title: 'Festa',
    description: 'Descrição',
    location: 'Salão',
    date: '2026-01-10',
  });

const dto = (media: Record<string, unknown> = {}) =>
  ({
    title: 'Festa revisada',
    media: {
      title: 'Cartaz',
      description: '',
      mediaType: MediaType.IMAGE,
      uploadType: UploadType.UPLOAD,
      isLocalFile: true,
      url: '',
      fieldKey: 'file',
      ...media,
    },
  }) as never;

describe('UpdateEventService', () => {
  const manager = {
    merge: jest.fn((_entity: unknown, target: object, extra: object) =>
      Object.assign(target, extra),
    ),
    save: jest.fn((_entity: unknown, value: unknown) => value),
  } as unknown as EntityManager;

  const dataSource = {
    transaction: jest.fn((run: (m: EntityManager) => Promise<unknown>) =>
      run(manager),
    ),
  };
  const eventRepo = { findById: jest.fn() };
  const s3Service = { upload: jest.fn(), delete: jest.fn() };
  const mediaItemProcessor = {
    findMediaItemsByTarget: jest.fn(),
    cleanAndReplaceMediaItems: jest.fn(),
    discardUnreferencedUploads: jest.fn(),
  };

  let service: UpdateEventService;

  beforeEach(async () => {
    jest.clearAllMocks();
    eventRepo.findById.mockResolvedValue(buildEvent());
    mediaItemProcessor.findMediaItemsByTarget.mockResolvedValue([storedMedia]);
    mediaItemProcessor.cleanAndReplaceMediaItems.mockResolvedValue([
      storedMedia,
    ]);

    const moduleRef = await Test.createTestingModule({
      providers: [
        UpdateEventService,
        { provide: DataSource, useValue: dataSource },
        { provide: EventRepository, useValue: eventRepo },
        { provide: AwsS3Service, useValue: s3Service },
        { provide: MediaItemProcessor, useValue: mediaItemProcessor },
      ],
    }).compile();

    service = moduleRef.get(UpdateEventService);
  });

  it('atualiza os campos do evento', async () => {
    const saved = await service.update('event-1', dto());

    expect(saved.title).toBe('Festa revisada');
    expect(dataSource.transaction).toHaveBeenCalledTimes(1);
  });

  it('delega a substituição da mídia com a mídia atual em mãos', async () => {
    const file = { originalname: 'nova.png', size: 42 } as Express.Multer.File;

    await service.update('event-1', dto(), file);

    const [items, targetId, targetType, filesDict, oldItems] =
      mediaItemProcessor.cleanAndReplaceMediaItems.mock.calls[0] as [
        Record<string, unknown>[],
        string,
        string,
        Record<string, unknown>,
        MediaItemEntity[],
      ];
    expect(items).toEqual([expect.objectContaining({ id: 'media-1' })]);
    expect(targetId).toBe('event-1');
    expect(targetType).toBe('Event');
    expect(filesDict).toEqual({ file });
    expect(oldItems).toEqual([storedMedia]);
  });

  it('não mexe na mídia quando o payload não a envia', async () => {
    await service.update('event-1', { title: 'Só o título' } as never);

    expect(mediaItemProcessor.cleanAndReplaceMediaItems).not.toHaveBeenCalled();
  });

  it('descarta do S3 o arquivo enviado quando a atualização falha', async () => {
    s3Service.upload.mockResolvedValue('https://s3/nova.png');
    mediaItemProcessor.cleanAndReplaceMediaItems.mockImplementation(
      async (
        _items: unknown,
        _targetId: string,
        _targetType: string,
        _filesDict: unknown,
        _old: unknown,
        _deleteFn: unknown,
        uploadFn: (f: Express.Multer.File) => Promise<string>,
      ) => {
        await uploadFn({ originalname: 'nova.png' } as Express.Multer.File);
        throw new Error('db down');
      },
    );

    await expect(service.update('event-1', dto())).rejects.toBeInstanceOf(
      AppInternalException,
    );

    expect(mediaItemProcessor.discardUnreferencedUploads).toHaveBeenCalledWith(
      ['https://s3/nova.png'],
      expect.any(Function),
    );
  });

  it('falha quando o evento não existe', async () => {
    eventRepo.findById.mockResolvedValue(null);

    await expect(service.update('x', dto())).rejects.toBeInstanceOf(
      AppNotFoundException,
    );
  });
});
