import { CreateIdeaSnapshotService } from '../../ideas-section-ai/services/create-idea-snapshot.service';
import { CreateIdeaAiEnhancementService } from '../../ideas-section-ai/services/create-idea-ai-enhancement.service';
import { Test } from '@nestjs/testing';
import { EntityManager } from 'typeorm';

import { AppValidationException } from 'src/shared/exceptions';
import { AwsS3Service } from 'src/shared/providers/aws/aws-s3.service';
import { MediaItemProcessor } from 'src/shared/media/media-item-processor';
import { MediaItemEntity } from 'src/shared/media/media-item/media-item.entity';
import { UploadType } from 'src/shared/media/media-item/media-item.entity';
import { PlatformType } from 'src/shared/media/media-item/media-item.entity';
import { MediaTargetType } from 'src/shared/media/media-target-type.enum';
import { NotificationService } from 'src/shared/providers/notification/notification.service';
import { IdeasSectionEntity } from 'src/modules/pages/ideas-page/entities/ideas-section.entity';

import { CreateIdeasSectionDto } from '../dto/create-ideas-section.dto';
import { IdeasSectionMediaType } from '../entities/ideas-section-media-type.enum';
import { IdeasSectionsRepository } from '../repositories/ideas-sections.repository';
import { CreateIdeasSectionService } from './create-ideas-section.service';

const buildSection = (): IdeasSectionEntity =>
  Object.assign(new IdeasSectionEntity(), {
    id: 'section-id',
    title: 'Ideia nova',
    description: 'texto',
    public: false,
    page: null,
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-01T00:00:00.000Z'),
  });

const dto: CreateIdeasSectionDto = {
  title: 'Ideia nova',
  description: 'texto',
  medias: [
    {
      uploadType: UploadType.LINK,
      mediaType: IdeasSectionMediaType.VIDEO,
      isLocalFile: false,
      url: 'https://youtu.be/abcdefghijk',
      platformType: PlatformType.YOUTUBE,
    },
  ],
};

describe('CreateIdeasSectionService', () => {
  const manager = {} as EntityManager;
  // A transação é aberta pelo repositório: o caso de uso entrega o bloco de
  // escritas e não conhece mais `DataSource`.
  const sectionRepo = {
    runInTransaction: jest.fn((run: (m: EntityManager) => Promise<unknown>) =>
      run(manager),
    ),
    createInTransaction: jest.fn(),
  };
  const mediaItemProcessor = {
    processMediaItemsPolymorphic: jest.fn(),
    findMediaItemsByTarget: jest.fn(),
    discardUnreferencedUploads: jest.fn(),
  };
  const snapshots = { capture: jest.fn() };
  const enhancements = { enqueueAutomatic: jest.fn() };
  const notificationService = { notifyNewIdeaShared: jest.fn() };
  const awsS3Service = { upload: jest.fn(), delete: jest.fn() };

  let service: CreateIdeasSectionService;

  beforeEach(async () => {
    jest.clearAllMocks();
    sectionRepo.createInTransaction.mockResolvedValue(buildSection());
    mediaItemProcessor.processMediaItemsPolymorphic.mockResolvedValue(
      [] as MediaItemEntity[],
    );
    notificationService.notifyNewIdeaShared.mockResolvedValue(undefined);

    const moduleRef = await Test.createTestingModule({
      providers: [
        {
          provide: CreateIdeaSnapshotService,
          useValue: snapshots,
        },
        {
          provide: CreateIdeaAiEnhancementService,
          useValue: enhancements,
        },
        CreateIdeasSectionService,
        { provide: IdeasSectionsRepository, useValue: sectionRepo },
        { provide: AwsS3Service, useValue: awsS3Service },
        { provide: MediaItemProcessor, useValue: mediaItemProcessor },
        { provide: NotificationService, useValue: notificationService },
      ],
    }).compile();

    service = moduleRef.get(CreateIdeasSectionService);
  });

  it('grava a ideia fora do ar e avisa a administração', async () => {
    const resposta = await service.createSection(
      dto,
      {},
      {
        email: 'quem@enviou.com',
      },
    );
    await Promise.resolve();

    expect(sectionRepo.runInTransaction).toHaveBeenCalledTimes(1);
    expect(
      mediaItemProcessor.processMediaItemsPolymorphic,
    ).toHaveBeenCalledWith(
      [
        expect.objectContaining({
          title: 'Vídeo 1 — Ideia nova',
          description: '',
        }),
      ],
      'section-id',
      MediaTargetType.IdeasSection,
      {},
      expect.anything(),
      manager,
    );
    // Nasce sem página e fora do ar: publicar é decisão da administração.
    expect(sectionRepo.createInTransaction).toHaveBeenCalledWith(manager, {
      title: 'Ideia nova',
      description: 'texto',
      public: false,
    });
    expect(notificationService.notifyNewIdeaShared).toHaveBeenCalledWith(
      expect.objectContaining({ title: 'Ideia nova' }),
      { email: 'quem@enviou.com' },
    );
    expect(resposta.pageId).toBeNull();
    expect(resposta.public).toBe(false);
  });

  it('recusa upload declarado sem o arquivo, antes de abrir transação', async () => {
    const comUpload: CreateIdeasSectionDto = {
      ...dto,
      medias: [
        {
          title: 'foto',
          uploadType: UploadType.UPLOAD,
          mediaType: IdeasSectionMediaType.IMAGE,
          isLocalFile: true,
          originalName: 'foto.jpg',
          fieldKey: 'ausente',
        },
      ],
    };

    await expect(service.createSection(comUpload, {})).rejects.toBeInstanceOf(
      AppValidationException,
    );

    expect(sectionRepo.runInTransaction).not.toHaveBeenCalled();
  });

  it('recusa link de documento antes de abrir transação ou iniciar upload', async () => {
    const invalid: CreateIdeasSectionDto = {
      ...dto,
      medias: [
        {
          uploadType: UploadType.LINK,
          mediaType: IdeasSectionMediaType.DOCUMENT,
          isLocalFile: false,
          url: 'https://example.test/guia.pdf',
        },
      ],
    };
    await expect(service.createSection(invalid, {})).rejects.toBeInstanceOf(
      AppValidationException,
    );
    expect(sectionRepo.runInTransaction).not.toHaveBeenCalled();
    expect(awsS3Service.upload).not.toHaveBeenCalled();
  });

  it('recusa envio sem nenhuma mídia', async () => {
    await expect(
      service.createSection({ ...dto, medias: [] }, {}),
    ).rejects.toBeInstanceOf(AppValidationException);
    expect(sectionRepo.runInTransaction).not.toHaveBeenCalled();
  });

  it('grava as mídias originais dentro da transação da ideia', async () => {
    await service.createSection(dto, {});

    expect(
      mediaItemProcessor.processMediaItemsPolymorphic,
    ).toHaveBeenCalledWith(
      expect.any(Array),
      'section-id',
      MediaTargetType.IdeasSection,
      {},
      expect.anything(),
      manager,
    );
    expect(mediaItemProcessor.findMediaItemsByTarget).not.toHaveBeenCalled();
  });

  it('persiste snapshot antes de responder sem esperar enqueue ou notificação', async () => {
    enhancements.enqueueAutomatic.mockImplementation(
      () => new Promise<void>(() => undefined),
    );
    notificationService.notifyNewIdeaShared.mockImplementation(
      () => new Promise<void>(() => undefined),
    );
    const result = await service.createSection(dto, {});
    expect(result.id).toBe('section-id');
    expect(snapshots.capture).toHaveBeenCalledWith(
      expect.objectContaining({ id: result.id }),
      [],
      manager,
      'SUBMISSION',
    );
    expect(enhancements.enqueueAutomatic).toHaveBeenCalledWith(result.id);
  });

  it('varre os arquivos já enviados quando a transação falha', async () => {
    sectionRepo.createInTransaction.mockRejectedValue(new Error('banco fora'));

    await expect(service.createSection(dto, {})).rejects.toThrow();

    expect(mediaItemProcessor.discardUnreferencedUploads).toHaveBeenCalledTimes(
      1,
    );
    expect(notificationService.notifyNewIdeaShared).not.toHaveBeenCalled();
  });
});
