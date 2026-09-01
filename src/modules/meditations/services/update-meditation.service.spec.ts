import { Test } from '@nestjs/testing';
import { DataSource, EntityManager } from 'typeorm';
import {
  AppConflictException,
  AppInternalException,
  AppNotFoundException,
  AppValidationException,
  ErrorCode,
} from 'src/shared/exceptions';
import { AwsS3Service } from 'src/shared/providers/aws/aws-s3.service';
import { MediaItemProcessor } from 'src/shared/media/media-item-processor';
import {
  MediaItemEntity,
  MediaType,
  UploadType,
} from 'src/shared/media/media-item/media-item.entity';
import { MeditationRepository } from '../repositories/meditation.repository';
import { MeditationEntity } from '../entities/meditation.entity';
import { DayEntity, WeekDay } from '../entities/day.entity';
import { GetMeditationService } from './get-meditation.service';
import { UpdateMeditationService } from './update-meditation.service';

const MONDAY = '2026-08-31';
const FRIDAY = '2026-09-04';

const buildMeditation = (
  overrides: Partial<MeditationEntity> = {},
): MeditationEntity =>
  Object.assign(new MeditationEntity(), {
    id: 'meditation-id',
    topic: 'Tema original',
    startDate: MONDAY,
    endDate: FRIDAY,
    days: [
      Object.assign(new DayEntity(), {
        id: 'day-1',
        day: WeekDay.Monday,
        verse: 'Sl 1',
        topic: 'Antigo',
      }),
    ],
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  });

const fullWeek = [
  WeekDay.Monday,
  WeekDay.Tuesday,
  WeekDay.Wednesday,
  WeekDay.Thursday,
  WeekDay.Friday,
].map((day) => ({ day, verse: 'Sl 1', topic: 'Novo' }));

describe('UpdateMeditationService', () => {
  const manager = {} as EntityManager;
  const dataSource = {
    transaction: jest.fn((run: (m: EntityManager) => Promise<unknown>) =>
      run(manager),
    ),
  };
  const meditationRepo = {
    findOverlapping: jest.fn(),
    saveMeditation: jest.fn(),
    removeDays: jest.fn(),
    saveDays: jest.fn(),
  };
  const getService = { findEntityOrFail: jest.fn(), findMediaOf: jest.fn() };
  const s3Service = { upload: jest.fn(), delete: jest.fn() };
  const mediaItemProcessor = {
    findMediaItemsByTarget: jest.fn(),
    cleanAndReplaceMediaItems: jest.fn(),
    discardUnreferencedUploads: jest.fn(),
  };

  let service: UpdateMeditationService;

  beforeEach(async () => {
    jest.clearAllMocks();

    getService.findEntityOrFail.mockResolvedValue(buildMeditation());
    getService.findMediaOf.mockResolvedValue(null);
    meditationRepo.findOverlapping.mockResolvedValue(null);
    meditationRepo.saveMeditation.mockImplementation(
      (meditation: MeditationEntity) => meditation,
    );
    meditationRepo.saveDays.mockResolvedValue([]);
    mediaItemProcessor.findMediaItemsByTarget.mockResolvedValue([]);
    mediaItemProcessor.cleanAndReplaceMediaItems.mockResolvedValue([{}]);

    const moduleRef = await Test.createTestingModule({
      providers: [
        UpdateMeditationService,
        { provide: DataSource, useValue: dataSource },
        { provide: MeditationRepository, useValue: meditationRepo },
        { provide: GetMeditationService, useValue: getService },
        { provide: AwsS3Service, useValue: s3Service },
        { provide: MediaItemProcessor, useValue: mediaItemProcessor },
      ],
    }).compile();

    service = moduleRef.get(UpdateMeditationService);
  });

  it('atualiza apenas os campos de conteúdo enviados', async () => {
    const result = await service.update('meditation-id', {
      topic: 'Tema novo',
    });

    expect(meditationRepo.saveMeditation).toHaveBeenCalledWith(
      expect.objectContaining({
        topic: 'Tema novo',
        startDate: MONDAY,
        endDate: FRIDAY,
      }),
      manager,
    );
    expect(result.topic).toBe('Tema novo');
  });

  it('ignora o id do corpo, preservando o da rota', async () => {
    // Um merge cego do DTO deixava o `id` do corpo sobrescrever a entidade.
    await service.update('meditation-id', { id: 'outro-id', topic: 'X' });

    expect(meditationRepo.saveMeditation).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'meditation-id' }),
      manager,
    );
  });

  it('mantém as datas atuais quando o payload não as envia', async () => {
    await service.update('meditation-id', { topic: 'X' });

    expect(meditationRepo.findOverlapping).toHaveBeenCalledWith(
      MONDAY,
      FRIDAY,
      'meditation-id',
    );
  });

  it('recusa período que não começa na segunda', async () => {
    await expect(
      service.update('meditation-id', { startDate: '2026-09-01' }),
    ).rejects.toBeInstanceOf(AppValidationException);
  });

  it('recusa sobreposição com outra meditação', async () => {
    meditationRepo.findOverlapping.mockResolvedValue(
      buildMeditation({ id: 'outra' }),
    );

    await expect(
      service.update('meditation-id', { topic: 'X' }),
    ).rejects.toBeInstanceOf(AppConflictException);
  });

  it('exclui a própria meditação da checagem de sobreposição', async () => {
    await service.update('meditation-id', { topic: 'X' });

    expect(meditationRepo.findOverlapping).toHaveBeenCalledWith(
      expect.any(String),
      expect.any(String),
      'meditation-id',
    );
  });

  it('substitui a semana inteira quando os dias são enviados', async () => {
    await service.update('meditation-id', { days: fullWeek });

    expect(meditationRepo.removeDays).toHaveBeenCalledWith(
      expect.arrayContaining([expect.objectContaining({ id: 'day-1' })]),
      manager,
    );
    expect(meditationRepo.saveDays).toHaveBeenCalledWith(
      expect.anything(),
      fullWeek,
      manager,
    );
  });

  it('não toca nos dias quando o payload não os envia', async () => {
    await service.update('meditation-id', { topic: 'X' });

    expect(meditationRepo.removeDays).not.toHaveBeenCalled();
    expect(meditationRepo.saveDays).not.toHaveBeenCalled();
  });

  it('substitui a mídia usando o arquivo enviado', async () => {
    const file = { originalname: 'a.pdf', size: 10 } as Express.Multer.File;

    await service.update(
      'meditation-id',
      {
        media: {
          title: 'Material',
          description: 'PDF',
          mediaType: MediaType.DOCUMENT,
          uploadType: UploadType.UPLOAD,
          isLocalFile: true,
        },
      },
      file,
    );

    expect(mediaItemProcessor.cleanAndReplaceMediaItems).toHaveBeenCalledWith(
      [expect.objectContaining({ isLocalFile: true, platformType: null })],
      'meditation-id',
      'Meditation',
      { file },
      [],
      expect.any(Function),
      expect.any(Function),
    );
  });

  it('não mexe na mídia quando o payload não a envia', async () => {
    await service.update('meditation-id', { topic: 'X' });

    expect(mediaItemProcessor.cleanAndReplaceMediaItems).not.toHaveBeenCalled();
  });

  it('reenvia a mídia atual quando a edição não troca o arquivo', async () => {
    // O formulário reenvia a mídia sem arquivo quando o usuário mexeu só nos
    // outros campos; o processador precisa receber o id e a mídia guardada
    // para reaproveitar o objeto que já está no S3.
    const stored = Object.assign(new MediaItemEntity(), {
      id: 'media-1',
      url: 'https://s3/antigo.pdf',
      isLocalFile: true,
    });
    mediaItemProcessor.findMediaItemsByTarget.mockResolvedValue([stored]);

    await service.update('meditation-id', {
      media: {
        title: 'Material',
        description: 'PDF',
        mediaType: MediaType.DOCUMENT,
        uploadType: UploadType.UPLOAD,
        isLocalFile: true,
        url: 'https://s3/antigo.pdf',
      },
    });

    const [items, , , filesDict, oldItems] = mediaItemProcessor
      .cleanAndReplaceMediaItems.mock.calls[0] as [
      Record<string, unknown>[],
      unknown,
      unknown,
      Record<string, unknown>,
      MediaItemEntity[],
    ];
    expect(items).toEqual([
      expect.objectContaining({
        id: 'media-1',
        url: 'https://s3/antigo.pdf',
      }),
    ]);
    expect(filesDict).toEqual({});
    expect(oldItems).toEqual([stored]);
  });

  it('descarta do S3 o arquivo enviado quando a atualização falha', async () => {
    const file = { originalname: 'a.pdf', size: 10 } as Express.Multer.File;
    s3Service.upload.mockResolvedValue('https://s3/a.pdf');
    // O upload já aconteceu quando a substituição falha: sem compensação, o
    // objeto ficaria no bucket sem nenhum registro apontando para ele.
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
        await uploadFn(file);
        throw new Error('db down');
      },
    );

    await expect(
      service.update(
        'meditation-id',
        {
          media: {
            title: 'Material',
            description: 'PDF',
            mediaType: MediaType.DOCUMENT,
            uploadType: UploadType.UPLOAD,
            isLocalFile: true,
          },
        },
        file,
      ),
    ).rejects.toBeInstanceOf(AppInternalException);

    expect(mediaItemProcessor.discardUnreferencedUploads).toHaveBeenCalledWith(
      ['https://s3/a.pdf'],
      expect.any(Function),
    );
  });

  it('propaga o not found de uma meditação inexistente', async () => {
    const notFound = new AppNotFoundException(
      ErrorCode.MEDITATION_NOT_FOUND,
      'Meditação não encontrada',
    );
    getService.findEntityOrFail.mockRejectedValue(notFound);

    await expect(service.update('x', { topic: 'X' })).rejects.toBe(notFound);
  });
});
