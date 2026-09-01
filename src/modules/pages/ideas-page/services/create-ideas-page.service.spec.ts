import { Test } from '@nestjs/testing';
import { DataSource, EntityManager } from 'typeorm';
import {
  AppInternalException,
  AppValidationException,
} from 'src/shared/exceptions';
import { RouteService } from 'src/modules/routes/route.service';
import { RouteType } from 'src/modules/routes/route-page.entity';
import { AwsS3Service } from 'src/shared/providers/aws/aws-s3.service';
import { MediaItemProcessor } from 'src/shared/media/media-item-processor';
import {
  MediaItemEntity,
  MediaType,
  UploadType,
} from 'src/shared/media/media-item/media-item.entity';
import { IdeasPageRepository } from '../repositories/ideas-page.repository';
import { IdeasPageEntity } from '../entities/ideas-page.entity';
import { IdeasSectionEntity } from '../entities/ideas-section.entity';
import { IdeasPageCreateService } from './create-ideas-page.service';

const route = {
  id: 'route-id',
  title: 'Ideias',
  subtitle: '',
  public: false,
  current: false,
  image: '',
  idToFetch: 'page-id',
  path: 'galeria_ideias_ideias',
  entityType: 'IdeasPage',
  description: '',
  entityId: 'page-id',
  type: RouteType.PAGE,
};

const buildSection = (id: string): IdeasSectionEntity =>
  Object.assign(new IdeasSectionEntity(), {
    id,
    title: `Seção ${id}`,
    description: '',
    public: false,
    createdAt: new Date(),
    updatedAt: new Date(),
  });

const buildPage = (sections: IdeasSectionEntity[] = []): IdeasPageEntity =>
  Object.assign(new IdeasPageEntity(), {
    id: 'page-id',
    title: 'Ideias',
    subtitle: '',
    description: 'Descrição',
    public: false,
    createdAt: new Date(),
    updatedAt: new Date(),
    sections,
    route,
  });

const uploadMedia = (overrides: Record<string, unknown> = {}) => ({
  title: 'Foto',
  description: '',
  mediaType: MediaType.IMAGE,
  uploadType: UploadType.UPLOAD,
  isLocalFile: true,
  fieldKey: 'image_0_0.png',
  ...overrides,
});

const validDto = (overrides: Record<string, unknown> = {}) =>
  ({
    title: 'Ideias',
    description: 'Descrição',
    sections: [],
    ...overrides,
  }) as never;

describe('IdeasPageCreateService', () => {
  const manager = {} as EntityManager;
  const queryRunner = {
    connect: jest.fn(),
    startTransaction: jest.fn(),
    commitTransaction: jest.fn(),
    rollbackTransaction: jest.fn(),
    release: jest.fn(),
    manager,
  };
  const dataSource = { createQueryRunner: jest.fn(() => queryRunner) };
  const ideasPageRepository = {
    createPage: jest.fn(),
    savePage: jest.fn(),
    createSection: jest.fn(),
    findByIdWithSections: jest.fn(),
    findSectionsOfPage: jest.fn(),
  };
  const routeService = {
    generateAvailablePath: jest.fn(),
    createRouteWithManager: jest.fn(),
  };
  const awsS3Service = { upload: jest.fn(), delete: jest.fn() };
  const mediaItemProcessor = {
    processMediaItemsPolymorphic: jest.fn(),
    findManyMediaItemsByTargets: jest.fn(),
    deleteMediaItems: jest.fn(),
    discardUnreferencedUploads: jest.fn(),
  };

  let service: IdeasPageCreateService;

  beforeEach(async () => {
    jest.clearAllMocks();

    ideasPageRepository.createPage.mockResolvedValue(buildPage());
    ideasPageRepository.savePage.mockImplementation(
      (page: IdeasPageEntity) => page,
    );
    ideasPageRepository.createSection.mockResolvedValue(buildSection('s1'));
    ideasPageRepository.findByIdWithSections.mockResolvedValue(
      buildPage([buildSection('s1')]),
    );
    ideasPageRepository.findSectionsOfPage.mockResolvedValue([]);
    routeService.generateAvailablePath.mockResolvedValue(
      'galeria_ideias_ideias',
    );
    routeService.createRouteWithManager.mockResolvedValue(route);
    mediaItemProcessor.processMediaItemsPolymorphic.mockResolvedValue([]);
    mediaItemProcessor.findManyMediaItemsByTargets.mockResolvedValue([]);

    const moduleRef = await Test.createTestingModule({
      providers: [
        IdeasPageCreateService,
        { provide: DataSource, useValue: dataSource },
        { provide: IdeasPageRepository, useValue: ideasPageRepository },
        { provide: RouteService, useValue: routeService },
        { provide: AwsS3Service, useValue: awsS3Service },
        { provide: MediaItemProcessor, useValue: mediaItemProcessor },
      ],
    }).compile();

    service = moduleRef.get(IdeasPageCreateService);
  });

  it('cria página, rota e seções em uma transação', async () => {
    const result = await service.createIdeasPage(
      validDto({
        sections: [{ title: 'Abertura', description: 'Materiais', medias: [] }],
      }),
      {},
    );

    expect(routeService.generateAvailablePath).toHaveBeenCalledWith(
      'Ideias',
      'galeria_ideias_',
    );
    expect(routeService.createRouteWithManager).toHaveBeenCalledWith(
      manager,
      expect.objectContaining({ public: false, entityType: 'IdeasPage' }),
    );
    expect(ideasPageRepository.createSection).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ title: 'Abertura', public: false }),
      manager,
    );
    expect(queryRunner.commitTransaction).toHaveBeenCalledTimes(1);
    expect(result.id).toBe('page-id');
  });

  it('anexa as mídias à seção recém-gravada, e não por índice', async () => {
    const media = Object.assign(new MediaItemEntity(), { id: 'm1' });
    mediaItemProcessor.processMediaItemsPolymorphic.mockResolvedValue([media]);

    const result = await service.createIdeasPage(
      validDto({
        sections: [
          {
            title: 'Abertura',
            description: '',
            medias: [uploadMedia()],
          },
        ],
      }),
      { 'image_0_0.png': {} as Express.Multer.File },
    );

    expect(
      mediaItemProcessor.processMediaItemsPolymorphic,
    ).toHaveBeenCalledWith(
      [expect.objectContaining({ fileField: 'image_0_0.png' })],
      's1',
      'IdeasSection',
      expect.anything(),
      expect.any(Function),
    );
    expect(result.sections[0].medias).toHaveLength(1);
  });

  it('recusa upload sem o arquivo antes de gravar qualquer coisa', async () => {
    await expect(
      service.createIdeasPage(
        validDto({
          sections: [{ title: 'A', description: '', medias: [uploadMedia()] }],
        }),
        {},
      ),
    ).rejects.toBeInstanceOf(AppValidationException);

    expect(ideasPageRepository.createPage).not.toHaveBeenCalled();
  });

  it('recusa upload sem fieldKey', async () => {
    await expect(
      service.createIdeasPage(
        validDto({
          sections: [
            {
              title: 'A',
              description: '',
              medias: [uploadMedia({ fieldKey: undefined })],
            },
          ],
        }),
        {},
      ),
    ).rejects.toBeInstanceOf(AppValidationException);
  });

  it('faz rollback e remove mídias órfãs quando a gravação falha', async () => {
    const orphan = Object.assign(new MediaItemEntity(), {
      id: 'm1',
      isLocalFile: true,
      url: 'https://s3/a.png',
    });
    ideasPageRepository.findSectionsOfPage.mockResolvedValue([
      buildSection('s1'),
    ]);
    mediaItemProcessor.findManyMediaItemsByTargets.mockResolvedValue([orphan]);
    routeService.createRouteWithManager.mockRejectedValue(new Error('db down'));

    await expect(
      service.createIdeasPage(validDto(), {}),
    ).rejects.toBeInstanceOf(AppInternalException);

    expect(queryRunner.rollbackTransaction).toHaveBeenCalledTimes(1);
    expect(mediaItemProcessor.deleteMediaItems).toHaveBeenCalledWith(
      [orphan],
      expect.any(Function),
    );
    expect(queryRunner.release).toHaveBeenCalledTimes(1);
  });
});
