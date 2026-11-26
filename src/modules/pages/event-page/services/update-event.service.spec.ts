import { Test } from '@nestjs/testing';
import {
  AppInternalException,
  AppNotFoundException,
  ErrorCode,
} from 'src/shared/exceptions';
import { GetEventService } from './get-event.service';
import { AwsS3Service } from 'src/shared/providers/aws/aws-s3.service';
import { MediaItemProcessor } from 'src/shared/media/media-item-processor';
import {
  MediaItemEntity,
  MediaType,
  UploadType,
} from 'src/shared/media/media-item/media-item.entity';
import { EventRepository } from '../repositories/event.repository';
import { EventEntity } from '../entities/event.entity';
import { UpdateEventService } from './update-event.service';
import { AnnounceEventService } from './announce-event.service';
import { ClubMeetingScheduleService } from './club-meeting-schedule.service';

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
  const eventRepo = {
    saveEvent: jest.fn((event: unknown) => Promise.resolve(event)),
  };
  const getService = {
    findEntityOrFail: jest.fn(),
    findMediaOf: jest.fn(),
  };
  const s3Service = { upload: jest.fn(), delete: jest.fn() };
  // Em que dias o evento acontece: a resposta do PATCH carrega isso.
  const scheduleService = {
    occurrencesByEvent: jest.fn().mockResolvedValue(new Map()),
  };
  const announceService = { announceInBackground: jest.fn() };
  const mediaItemProcessor = {
    findMediaItemsByTarget: jest.fn(),
    cleanAndReplaceMediaItems: jest.fn(),
    discardUnreferencedUploads: jest.fn(),
  };

  let service: UpdateEventService;

  beforeEach(async () => {
    jest.clearAllMocks();
    getService.findEntityOrFail.mockResolvedValue(buildEvent());
    getService.findMediaOf.mockResolvedValue(storedMedia);
    eventRepo.saveEvent.mockImplementation((event: unknown) =>
      Promise.resolve(event),
    );
    mediaItemProcessor.findMediaItemsByTarget.mockResolvedValue([storedMedia]);
    mediaItemProcessor.cleanAndReplaceMediaItems.mockResolvedValue([
      storedMedia,
    ]);

    const moduleRef = await Test.createTestingModule({
      providers: [
        UpdateEventService,
        { provide: EventRepository, useValue: eventRepo },
        { provide: GetEventService, useValue: getService },
        { provide: AwsS3Service, useValue: s3Service },
        { provide: MediaItemProcessor, useValue: mediaItemProcessor },
        { provide: AnnounceEventService, useValue: announceService },
        { provide: ClubMeetingScheduleService, useValue: scheduleService },
      ],
    }).compile();

    service = moduleRef.get(UpdateEventService);
  });

  it('atualiza os campos do evento', async () => {
    const saved = await service.update('event-1', dto());

    expect(saved.title).toBe('Festa revisada');
    expect(eventRepo.saveEvent).toHaveBeenCalledTimes(1);
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

  it('avisa a base depois de gravar a alteração', async () => {
    await service.update('event-1', dto());

    expect(announceService.announceInBackground).toHaveBeenCalledWith(
      'updated',
      expect.objectContaining({ id: 'event-1' }),
    );
  });

  it('falha quando o evento não existe', async () => {
    getService.findEntityOrFail.mockRejectedValue(
      new AppNotFoundException(ErrorCode.EVENT_NOT_FOUND, 'não encontrado'),
    );

    await expect(service.update('x', dto())).rejects.toBeInstanceOf(
      AppNotFoundException,
    );
  });

  it('devolve em que dias o evento acontece', async () => {
    // Sem isto a resposta voltava com `occurrences` vazio — que no contrato
    // significa "não acontece em dia nenhum". A tela recarrega a agenda depois
    // de salvar e escondia o erro, mas o corpo da resposta estava mentindo.
    scheduleService.occurrencesByEvent.mockResolvedValue(
      new Map([['event-1', ['2026-04-12']]]),
    );

    const response = await service.update('event-1', { title: 'Festa' });

    expect(response.occurrences).toEqual(['2026-04-12']);
  });
});
