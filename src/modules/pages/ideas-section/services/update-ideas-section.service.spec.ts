import { UpdateIdeaAiPublicationService } from '../../ideas-section-ai/services/update-idea-ai-publication.service';
import { Test } from '@nestjs/testing';
import { EntityManager } from 'typeorm';

import { AwsS3Service } from 'src/shared/providers/aws/aws-s3.service';
import { MediaItemProcessor } from 'src/shared/media/media-item-processor';
import {
  MediaItemEntity,
  MediaType,
  UploadType,
} from 'src/shared/media/media-item/media-item.entity';
import { AppValidationException } from 'src/shared/exceptions';
import { IdeasSectionEntity } from 'src/modules/pages/ideas-page/entities/ideas-section.entity';
import { IdeasSectionMediaType } from '../entities/ideas-section-media-type.enum';
import { IdeasPageEntity } from 'src/modules/pages/ideas-page/entities/ideas-page.entity';

import { UpdateIdeasSectionDto } from '../dto/update-ideas-section.dto';
import { IdeasSectionsRepository } from '../repositories/ideas-sections.repository';
import { GetIdeasSectionsService } from './get-ideas-sections.service';
import { IdeasSectionMediaService } from './ideas-section-media.service';
import { UpdateIdeasSectionService } from './update-ideas-section.service';

const buildSection = (page?: IdeasPageEntity): IdeasSectionEntity =>
  Object.assign(new IdeasSectionEntity(), {
    id: 'section-id',
    title: 'Ideia antiga',
    description: 'antes',
    public: false,
    page: page ?? null,
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-01T00:00:00.000Z'),
  });

const dto: UpdateIdeasSectionDto = {
  title: 'Ideia editada',
  description: 'depois',
  public: true,
  medias: [],
};

describe('UpdateIdeasSectionService', () => {
  const manager = {} as EntityManager;
  // A transação é aberta pelo repositório: o caso de uso entrega o bloco de
  // escritas e não conhece mais `DataSource`.
  const sectionRepo = {
    runInTransaction: jest.fn((run: (m: EntityManager) => Promise<unknown>) =>
      run(manager),
    ),
    saveInTransaction: jest.fn(),
  };
  const mediaService = {
    findExisting: jest.fn(),
    deleteMedia: jest.fn(),
    processSectionMedia: jest.fn(),
  };
  const mediaItemProcessor = { discardUnreferencedUploads: jest.fn() };
  const getService = { findEntityOrFail: jest.fn() };
  const awsS3Service = { upload: jest.fn(), delete: jest.fn() };

  let service: UpdateIdeasSectionService;

  beforeEach(async () => {
    jest.clearAllMocks();
    mediaService.findExisting.mockResolvedValue([]);
    mediaService.processSectionMedia.mockResolvedValue([] as MediaItemEntity[]);
    sectionRepo.saveInTransaction.mockImplementation(
      (_m: EntityManager, data: Partial<IdeasSectionEntity>) =>
        Promise.resolve(Object.assign(buildSection(), data)),
    );

    const moduleRef = await Test.createTestingModule({
      providers: [
        {
          provide: UpdateIdeaAiPublicationService,
          useValue: {
            prepare: jest.fn(
              async (
                id: string,
                input: UpdateIdeasSectionDto,
                m: EntityManager,
              ) => ({
                dto: input,
                existingMedia: (await mediaService.findExisting(
                  id,
                  m,
                )) as MediaItemEntity[],
              }),
            ),
          },
        },
        UpdateIdeasSectionService,
        { provide: IdeasSectionsRepository, useValue: sectionRepo },
        { provide: AwsS3Service, useValue: awsS3Service },
        { provide: MediaItemProcessor, useValue: mediaItemProcessor },
        { provide: IdeasSectionMediaService, useValue: mediaService },
        { provide: GetIdeasSectionsService, useValue: getService },
      ],
    }).compile();

    service = moduleRef.get(UpdateIdeasSectionService);
  });

  it('grava texto e mídias na mesma transação, sem mexer na publicação', async () => {
    const page = Object.assign(new IdeasPageEntity(), { id: 'page-id' });
    getService.findEntityOrFail.mockResolvedValue(buildSection(page));

    const resposta = await service.updateSection('section-id', dto, {});

    expect(sectionRepo.runInTransaction).toHaveBeenCalledTimes(1);
    // O `id` vai junto e a página fica como estava: editar não republica nem
    // despublica a ideia.
    expect(sectionRepo.saveInTransaction).toHaveBeenCalledWith(
      manager,
      expect.objectContaining({ id: 'section-id', page }),
    );
    expect(mediaService.findExisting).toHaveBeenCalledWith(
      'section-id',
      manager,
    );
    expect(mediaService.deleteMedia).toHaveBeenCalledWith([], [], manager);
    expect(mediaService.processSectionMedia).toHaveBeenCalledWith(
      [],
      'section-id',
      [],
      {},
      manager,
      expect.anything(),
      'Ideia editada',
      'Ideia antiga',
    );
    expect(resposta.pageId).toBe('page-id');
  });

  it('mantém a ideia pendente quando ela ainda não tem página', async () => {
    getService.findEntityOrFail.mockResolvedValue(buildSection());

    const resposta = await service.updateSection('section-id', dto, {});

    expect(sectionRepo.saveInTransaction).toHaveBeenCalledWith(
      manager,
      expect.objectContaining({ page: undefined }),
    );
    expect(resposta.pageId).toBeNull();
  });

  it('aceita mídia de upload já gravada reenviada só com id, sem arquivo novo', async () => {
    getService.findEntityOrFail.mockResolvedValue(buildSection());
    const reenviada = {
      id: 'media-id',
      title: 'Passo a passo',
      uploadType: UploadType.UPLOAD,
      mediaType: IdeasSectionMediaType.DOCUMENT,
      isLocalFile: true,
      url: 'https://s3/passo-a-passo.pdf',
      originalName: 'passo-a-passo.pdf',
    };
    mediaService.findExisting.mockResolvedValue([
      Object.assign(new MediaItemEntity(), {
        id: 'media-id',
        mediaType: MediaType.DOCUMENT,
        uploadType: UploadType.UPLOAD,
        isLocalFile: true,
        url: 'https://s3/passo-a-passo.pdf',
      }),
    ]);

    // Antes, a checagem de arquivos exigia o upload de novo e recusava toda
    // edição de uma ideia que tivesse arquivo; quem reaproveita é o serviço
    // de mídia.
    await service.updateSection(
      'section-id',
      { ...dto, medias: [reenviada] },
      {},
    );

    expect(mediaService.processSectionMedia).toHaveBeenCalledWith(
      [reenviada],
      'section-id',
      expect.arrayContaining([expect.objectContaining({ id: 'media-id' })]),
      {},
      manager,
      expect.anything(),
      'Ideia editada',
      'Ideia antiga',
    );
  });

  it('recusa mídia nova de upload que veio sem arquivo, antes de abrir transação', async () => {
    getService.findEntityOrFail.mockResolvedValue(buildSection());

    await expect(
      service.updateSection(
        'section-id',
        {
          ...dto,
          medias: [
            {
              title: 'Nova',
              uploadType: UploadType.UPLOAD,
              mediaType: IdeasSectionMediaType.IMAGE,
              isLocalFile: true,
              originalName: 'nova.png',
              fieldKey: 'nova',
            },
          ],
        },
        {},
      ),
    ).rejects.toBeInstanceOf(AppValidationException);

    expect(sectionRepo.runInTransaction).not.toHaveBeenCalled();
  });

  it('varre os arquivos já enviados quando a transação falha', async () => {
    getService.findEntityOrFail.mockResolvedValue(buildSection());
    sectionRepo.saveInTransaction.mockRejectedValue(new Error('banco fora'));

    await expect(
      service.updateSection('section-id', dto, {}),
    ).rejects.toThrow();

    expect(mediaItemProcessor.discardUnreferencedUploads).toHaveBeenCalledTimes(
      1,
    );
  });
});
