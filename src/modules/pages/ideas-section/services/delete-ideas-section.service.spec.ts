import { DeleteIdeaAiAssetsService } from '../../ideas-section-ai/services/delete-idea-ai-assets.service';
import { Test } from '@nestjs/testing';
import { EntityManager } from 'typeorm';

import {
  AppBusinessException,
  AppNotFoundException,
} from 'src/shared/exceptions';
import { AwsS3Service } from 'src/shared/providers/aws/aws-s3.service';
import { MediaItemProcessor } from 'src/shared/media/media-item-processor';
import { MediaItemEntity } from 'src/shared/media/media-item/media-item.entity';
import { MediaTargetType } from 'src/shared/media/media-target-type.enum';
import { IdeasSectionEntity } from 'src/modules/pages/ideas-page/entities/ideas-section.entity';
import { IdeasPageEntity } from 'src/modules/pages/ideas-page/entities/ideas-page.entity';

import { IdeasSectionsRepository } from '../repositories/ideas-sections.repository';
import { DeleteIdeasSectionService } from './delete-ideas-section.service';

const buildSection = (page?: IdeasPageEntity): IdeasSectionEntity =>
  Object.assign(new IdeasSectionEntity(), {
    id: 'section-id',
    title: 'Ideia',
    description: '',
    public: false,
    page: page ?? null,
  });

const buildMedia = (
  id: string,
  isLocalFile: boolean,
  url: string,
): MediaItemEntity =>
  Object.assign(new MediaItemEntity(), {
    id,
    url,
    isLocalFile,
    targetId: 'section-id',
    targetType: MediaTargetType.IdeasSection,
  });

describe('DeleteIdeasSectionService', () => {
  const manager = {} as EntityManager;
  // A transação é aberta pelo repositório: o caso de uso entrega o bloco de
  // escritas e não conhece mais `DataSource`.
  const sectionRepo = {
    runInTransaction: jest.fn((run: (m: EntityManager) => Promise<unknown>) =>
      run(manager),
    ),
    findByIdInTransaction: jest.fn(),
    deleteByIdInTransaction: jest.fn(),
  };
  const mediaItemProcessor = {
    discardUnreferencedUploads: jest.fn(
      async (urls: string[], remove: (url: string) => Promise<void>) => {
        for (const url of urls) await remove(url);
        return urls.length;
      },
    ),
    findMediaItemsByTargetInTransaction: jest.fn(),
    deleteMediaItemsByTargetInTransaction: jest.fn(),
  };
  const awsS3Service = { delete: jest.fn() };

  let service: DeleteIdeasSectionService;

  beforeEach(async () => {
    jest.clearAllMocks();

    const moduleRef = await Test.createTestingModule({
      providers: [
        {
          provide: DeleteIdeaAiAssetsService,
          useValue: { remove: jest.fn().mockResolvedValue([]) },
        },
        DeleteIdeasSectionService,
        { provide: IdeasSectionsRepository, useValue: sectionRepo },
        { provide: MediaItemProcessor, useValue: mediaItemProcessor },
        { provide: AwsS3Service, useValue: awsS3Service },
      ],
    }).compile();

    service = moduleRef.get(DeleteIdeasSectionService);
  });

  it('apaga mídias e seção na mesma transação e só então limpa o bucket', async () => {
    sectionRepo.findByIdInTransaction.mockResolvedValue(buildSection());
    mediaItemProcessor.findMediaItemsByTargetInTransaction.mockResolvedValue([
      buildMedia('m1', true, 'https://bucket/arquivo.jpg'),
      buildMedia('m2', false, 'https://youtu.be/abc'),
    ]);

    const ordem: string[] = [];
    sectionRepo.deleteByIdInTransaction.mockImplementation(() => {
      ordem.push('banco');
      return Promise.resolve();
    });
    awsS3Service.delete.mockImplementation(() => {
      ordem.push('s3');
      return Promise.resolve();
    });

    await service.deleteSection('section-id');

    expect(sectionRepo.runInTransaction).toHaveBeenCalledTimes(1);
    expect(
      mediaItemProcessor.deleteMediaItemsByTargetInTransaction,
    ).toHaveBeenCalledWith(manager, 'section-id', MediaTargetType.IdeasSection);
    expect(sectionRepo.deleteByIdInTransaction).toHaveBeenCalledWith(
      manager,
      'section-id',
    );
    // Só o arquivo local sai do bucket, e depois do commit.
    expect(awsS3Service.delete).toHaveBeenCalledTimes(1);
    expect(awsS3Service.delete).toHaveBeenCalledWith(
      'https://bucket/arquivo.jpg',
    );
    expect(ordem).toEqual(['banco', 's3']);
  });

  it('não apaga o que já foi publicado em uma página', async () => {
    const page = Object.assign(new IdeasPageEntity(), { id: 'page-id' });
    sectionRepo.findByIdInTransaction.mockResolvedValue(buildSection(page));

    await expect(service.deleteSection('section-id')).rejects.toBeInstanceOf(
      AppBusinessException,
    );

    expect(sectionRepo.deleteByIdInTransaction).not.toHaveBeenCalled();
    expect(awsS3Service.delete).not.toHaveBeenCalled();
  });

  it('avisa quando a ideia não existe', async () => {
    sectionRepo.findByIdInTransaction.mockResolvedValue(null);

    await expect(service.deleteSection('sumida')).rejects.toBeInstanceOf(
      AppNotFoundException,
    );

    expect(sectionRepo.deleteByIdInTransaction).not.toHaveBeenCalled();
  });

  it('não toca no bucket quando a transação falha', async () => {
    sectionRepo.findByIdInTransaction.mockResolvedValue(buildSection());
    mediaItemProcessor.findMediaItemsByTargetInTransaction.mockResolvedValue([
      buildMedia('m1', true, 'https://bucket/arquivo.jpg'),
    ]);
    sectionRepo.deleteByIdInTransaction.mockRejectedValue(
      new Error('banco fora'),
    );

    await expect(service.deleteSection('section-id')).rejects.toThrow();

    expect(awsS3Service.delete).not.toHaveBeenCalled();
  });
});
