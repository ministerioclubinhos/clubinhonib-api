import { Test } from '@nestjs/testing';
import { EntityManager } from 'typeorm';

import { AppValidationException } from 'src/shared/exceptions';
import { AwsS3Service } from 'src/shared/providers/aws/aws-s3.service';
import { MediaItemProcessor } from 'src/shared/media/media-item-processor';
import { MediaItemEntity } from 'src/shared/media/media-item/media-item.entity';
import { UploadType } from 'src/shared/media/media-item/media-item.entity';
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
  medias: [],
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
  const notificationService = { notifyNewIdeaShared: jest.fn() };
  const awsS3Service = { upload: jest.fn(), delete: jest.fn() };

  let service: CreateIdeasSectionService;

  beforeEach(async () => {
    jest.clearAllMocks();
    sectionRepo.createInTransaction.mockResolvedValue(buildSection());
    mediaItemProcessor.findMediaItemsByTarget.mockResolvedValue(
      [] as MediaItemEntity[],
    );

    const moduleRef = await Test.createTestingModule({
      providers: [
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

    expect(sectionRepo.runInTransaction).toHaveBeenCalledTimes(1);
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

  it('lê as mídias gravadas depois do commit', async () => {
    await service.createSection(dto, {});

    expect(mediaItemProcessor.findMediaItemsByTarget).toHaveBeenCalledWith(
      'section-id',
      MediaTargetType.IdeasSection,
    );
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
