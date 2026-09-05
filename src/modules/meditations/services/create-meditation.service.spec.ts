import { Test } from '@nestjs/testing';
import { EntityManager } from 'typeorm';
import {
  AppConflictException,
  AppInternalException,
  AppValidationException,
} from 'src/shared/exceptions';
import { CreateRouteService } from 'src/modules/routes/services/create-route.service';
import { AwsS3Service } from 'src/shared/providers/aws/aws-s3.service';
import { MediaItemProcessor } from 'src/shared/media/media-item-processor';
import {
  MediaItemEntity,
  MediaType,
  UploadType,
} from 'src/shared/media/media-item/media-item.entity';
import { MeditationRepository } from '../repositories/meditation.repository';
import { MeditationEntity } from '../entities/meditation.entity';
import { WeekDay } from '../entities/day.entity';
import { CreateMeditationDto } from '../dto/create-meditation.dto';
import { CreateMeditationService } from './create-meditation.service';

const MONDAY = '2026-08-31';
const FRIDAY = '2026-09-04';

const validDto = (
  overrides: Partial<CreateMeditationDto> = {},
): CreateMeditationDto =>
  Object.assign(new CreateMeditationDto(), {
    topic: 'Semana da gratidão',
    startDate: MONDAY,
    endDate: FRIDAY,
    media: {
      title: 'Material',
      description: 'PDF',
      mediaType: MediaType.DOCUMENT,
      uploadType: UploadType.LINK,
      isLocalFile: false,
      url: 'https://drive.google.com/file/d/1/view',
    },
    days: [
      WeekDay.Monday,
      WeekDay.Tuesday,
      WeekDay.Wednesday,
      WeekDay.Thursday,
      WeekDay.Friday,
    ].map((day) => ({ day, verse: 'Sl 1', topic: 'Tema' })),
    ...overrides,
  });

describe('CreateMeditationService', () => {
  const manager = {} as EntityManager;
  // A transação passou a ser aberta pelo repositório: o caso de uso entrega o
  // bloco de escritas e não conhece mais `DataSource`.
  const meditationRepo = {
    findOverlapping: jest.fn(),
    createMeditation: jest.fn(),
    runInTransaction: jest.fn((run: (m: EntityManager) => Promise<unknown>) =>
      run(manager),
    ),
  };
  const s3Service = { upload: jest.fn(), delete: jest.fn() };
  const createRouteService = {
    generateAvailablePath: jest.fn(),
    createRouteWithManager: jest.fn(),
  };
  const mediaItemProcessor = {
    buildBaseMediaItem: jest.fn(),
    saveMediaItem: jest.fn(),
    findMediaItemsByTarget: jest.fn(),
    deleteMediaItems: jest.fn(),
    discardUnreferencedUploads: jest.fn(),
  };

  let service: CreateMeditationService;

  const savedMeditation = Object.assign(new MeditationEntity(), {
    id: 'meditation-id',
    topic: 'Semana da gratidão',
    startDate: MONDAY,
    endDate: FRIDAY,
    days: [],
    createdAt: new Date(),
    updatedAt: new Date(),
  });

  beforeEach(async () => {
    jest.clearAllMocks();

    meditationRepo.findOverlapping.mockResolvedValue(null);
    meditationRepo.createMeditation.mockResolvedValue(savedMeditation);
    createRouteService.generateAvailablePath.mockResolvedValue(
      'meditacao_semana',
    );
    createRouteService.createRouteWithManager.mockResolvedValue({
      id: 'route-id',
    });
    mediaItemProcessor.buildBaseMediaItem.mockImplementation(
      (item: Record<string, unknown>) =>
        Object.assign(new MediaItemEntity(), item),
    );
    mediaItemProcessor.saveMediaItem.mockImplementation(
      (media: MediaItemEntity) => ({ ...media, id: 'media-id' }),
    );

    const moduleRef = await Test.createTestingModule({
      providers: [
        CreateMeditationService,
        { provide: MeditationRepository, useValue: meditationRepo },
        { provide: AwsS3Service, useValue: s3Service },
        { provide: CreateRouteService, useValue: createRouteService },
        { provide: MediaItemProcessor, useValue: mediaItemProcessor },
      ],
    }).compile();

    service = moduleRef.get(CreateMeditationService);
  });

  it('cria meditação, rota e mídia em uma transação só', async () => {
    const result = await service.create(validDto());

    // Meditação e rota entram na mesma transação, com o mesmo `manager`.
    expect(meditationRepo.runInTransaction).toHaveBeenCalledTimes(1);
    expect(meditationRepo.createMeditation).toHaveBeenCalledWith(
      expect.objectContaining({ topic: 'Semana da gratidão' }),
      expect.any(Array),
      manager,
    );
    expect(createRouteService.createRouteWithManager).toHaveBeenCalledWith(
      manager,
      expect.objectContaining({ entityType: 'Meditation' }),
    );
    expect(result.id).toBe('meditation-id');
  });

  it('checa sobreposição no banco, sem carregar a tabela', async () => {
    await service.create(validDto());

    expect(meditationRepo.findOverlapping).toHaveBeenCalledWith(
      MONDAY,
      FRIDAY,
      undefined,
    );
  });

  it('recusa período que não começa na segunda', async () => {
    await expect(
      service.create(validDto({ startDate: '2026-09-01' })),
    ).rejects.toBeInstanceOf(AppValidationException);
    expect(meditationRepo.runInTransaction).not.toHaveBeenCalled();
  });

  it('recusa sobreposição com meditação existente', async () => {
    meditationRepo.findOverlapping.mockResolvedValue(savedMeditation);

    await expect(service.create(validDto())).rejects.toBeInstanceOf(
      AppConflictException,
    );
    expect(meditationRepo.runInTransaction).not.toHaveBeenCalled();
  });

  it('exige o arquivo quando a mídia é um upload', async () => {
    const dto = validDto({
      media: {
        title: 'Material',
        description: 'PDF',
        mediaType: MediaType.DOCUMENT,
        uploadType: UploadType.UPLOAD,
        isLocalFile: true,
      },
    });

    // O bloco lança dentro da transação, e o repositório desfaz o que já
    // tinha sido gravado.
    await expect(service.create(dto)).rejects.toBeInstanceOf(
      AppValidationException,
    );
    expect(meditationRepo.runInTransaction).toHaveBeenCalledTimes(1);
  });

  it('sobe o arquivo e guarda os metadados quando há upload', async () => {
    s3Service.upload.mockResolvedValue('https://s3/meditacao.pdf');
    const file = { originalname: 'a.pdf', size: 42 } as Express.Multer.File;

    await service.create(
      validDto({
        media: {
          title: 'Material',
          description: 'PDF',
          mediaType: MediaType.DOCUMENT,
          uploadType: UploadType.UPLOAD,
          isLocalFile: true,
        },
      }),
      file,
    );

    expect(s3Service.upload).toHaveBeenCalledWith(file);
    expect(mediaItemProcessor.buildBaseMediaItem).toHaveBeenCalledWith(
      expect.objectContaining({
        url: 'https://s3/meditacao.pdf',
        originalName: 'a.pdf',
        size: 42,
      }),
      'meditation-id',
      'Meditation',
    );
  });

  it('faz rollback e limpa mídia órfã quando a criação falha', async () => {
    const orphan = Object.assign(new MediaItemEntity(), {
      id: 'orphan',
      isLocalFile: true,
      url: 'https://s3/orphan.pdf',
    });
    mediaItemProcessor.saveMediaItem.mockRejectedValue(new Error('db down'));
    mediaItemProcessor.findMediaItemsByTarget.mockResolvedValue([orphan]);

    await expect(service.create(validDto())).rejects.toBeInstanceOf(
      AppInternalException,
    );

    expect(meditationRepo.runInTransaction).toHaveBeenCalledTimes(1);
    expect(mediaItemProcessor.deleteMediaItems).toHaveBeenCalledWith(
      [orphan],
      expect.any(Function),
    );
  });
});
