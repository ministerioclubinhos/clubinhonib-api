import { Test } from '@nestjs/testing';
import { EntityManager } from 'typeorm';

import {
  AppBusinessException,
  AppNotFoundException,
} from 'src/shared/exceptions';
import { AwsS3Service } from 'src/shared/providers/aws/aws-s3.service';
import { MediaItemProcessor } from 'src/shared/media/media-item-processor';
import { MediaItemEntity } from 'src/shared/media/media-item/media-item.entity';
import { IdeasSectionEntity } from 'src/modules/pages/ideas-page/entities/ideas-section.entity';
import { IdeasPageEntity } from 'src/modules/pages/ideas-page/entities/ideas-page.entity';

import { UpdateIdeasSectionDto } from '../dto/update-ideas-section.dto';
import { IdeasSectionsRepository } from '../repositories/ideas-sections.repository';
import { GetIdeasSectionsService } from './get-ideas-sections.service';
import { IdeasSectionMediaService } from './ideas-section-media.service';
import { AttachIdeasSectionService } from './attach-ideas-section.service';

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
  title: 'Ideia publicada',
  description: 'depois',
  public: true,
  medias: [],
};

describe('AttachIdeasSectionService', () => {
  const manager = {} as EntityManager;
  // A transação é aberta pelo repositório: o caso de uso entrega o bloco de
  // escritas e não conhece mais `DataSource`.
  const sectionRepo = {
    runInTransaction: jest.fn((run: (m: EntityManager) => Promise<unknown>) =>
      run(manager),
    ),
    findPageById: jest.fn(),
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

  let service: AttachIdeasSectionService;

  beforeEach(async () => {
    jest.clearAllMocks();
    mediaService.findExisting.mockResolvedValue([]);
    mediaService.processSectionMedia.mockResolvedValue([] as MediaItemEntity[]);

    const moduleRef = await Test.createTestingModule({
      providers: [
        AttachIdeasSectionService,
        { provide: IdeasSectionsRepository, useValue: sectionRepo },
        { provide: AwsS3Service, useValue: awsS3Service },
        { provide: MediaItemProcessor, useValue: mediaItemProcessor },
        { provide: IdeasSectionMediaService, useValue: mediaService },
        { provide: GetIdeasSectionsService, useValue: getService },
      ],
    }).compile();

    service = moduleRef.get(AttachIdeasSectionService);
  });

  it('publica a ideia na página dentro de uma única transação', async () => {
    const page = Object.assign(new IdeasPageEntity(), { id: 'page-id' });
    getService.findEntityOrFail.mockResolvedValue(buildSection());
    sectionRepo.findPageById.mockResolvedValue(page);
    sectionRepo.saveInTransaction.mockImplementation(
      (_m: EntityManager, data: Partial<IdeasSectionEntity>) =>
        Promise.resolve(Object.assign(buildSection(), data)),
    );

    const resposta = await service.attachToPage(
      'section-id',
      'page-id',
      dto,
      {},
    );

    expect(sectionRepo.runInTransaction).toHaveBeenCalledTimes(1);
    // O `id` precisa ir junto: sem ele o `save` cria uma seção nova e deixa a
    // original parada na fila.
    expect(sectionRepo.saveInTransaction).toHaveBeenCalledWith(
      manager,
      expect.objectContaining({ id: 'section-id', page }),
    );
    // A leitura das mídias e as duas escritas usam o mesmo manager.
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
    );
    expect(resposta.pageId).toBe('page-id');
    expect(
      mediaItemProcessor.discardUnreferencedUploads,
    ).not.toHaveBeenCalled();
  });

  it('recusa a ideia que já está publicada, sem abrir transação', async () => {
    const page = Object.assign(new IdeasPageEntity(), { id: 'outra' });
    getService.findEntityOrFail.mockResolvedValue(buildSection(page));

    await expect(
      service.attachToPage('section-id', 'page-id', dto, {}),
    ).rejects.toBeInstanceOf(AppBusinessException);

    expect(sectionRepo.runInTransaction).not.toHaveBeenCalled();
  });

  it('página inexistente sobe como não encontrada, não como erro interno', async () => {
    getService.findEntityOrFail.mockResolvedValue(buildSection());
    sectionRepo.findPageById.mockResolvedValue(null);

    await expect(
      service.attachToPage('section-id', 'sumida', dto, {}),
    ).rejects.toBeInstanceOf(AppNotFoundException);

    expect(sectionRepo.saveInTransaction).not.toHaveBeenCalled();
  });

  it('varre os arquivos já enviados quando a transação falha', async () => {
    const page = Object.assign(new IdeasPageEntity(), { id: 'page-id' });
    getService.findEntityOrFail.mockResolvedValue(buildSection());
    sectionRepo.findPageById.mockResolvedValue(page);
    sectionRepo.saveInTransaction.mockRejectedValue(new Error('banco fora'));

    await expect(
      service.attachToPage('section-id', 'page-id', dto, {}),
    ).rejects.toThrow();

    expect(mediaItemProcessor.discardUnreferencedUploads).toHaveBeenCalledTimes(
      1,
    );
  });
});
