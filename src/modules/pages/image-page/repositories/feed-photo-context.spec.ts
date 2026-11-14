import { DataSource, Repository } from 'typeorm';
import {
  MediaItemEntity,
  MediaType,
} from 'src/shared/media/media-item/media-item.entity';
import { ImagePageRepository } from './image-page.repository';
import { ImagePageEntity } from '../entity/Image-page.entity';
import { ImageSectionEntity } from '../entity/Image-section.entity';
import { IMAGE_PAGE_ENTITY_TYPE } from '../constants';

describe('Feed photo context scope', () => {
  const qb = {
    innerJoin: jest.fn().mockReturnThis(),
    select: jest.fn().mockReturnThis(),
    addSelect: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    getRawOne: jest.fn(),
  };
  const sectionRepo = { createQueryBuilder: jest.fn().mockReturnValue(qb) };
  const repository = new ImagePageRepository(
    {} as DataSource,
    {} as Repository<ImagePageEntity>,
    sectionRepo as unknown as Repository<ImageSectionEntity>,
  );

  it.each([MediaType.IMAGE, MediaType.VIDEO])(
    'allows %s only in the configured feed and section target',
    async (mediaType) => {
      qb.getRawOne.mockResolvedValue({
        mediaId: 'photo',
        pageId: 'feed',
        sectionPublic: 1,
        pagePublic: 0,
        mediaType,
      });
      const result = await repository.findFeedPhotoContext('photo', 'feed');
      expect(qb.innerJoin).toHaveBeenCalledWith(
        MediaItemEntity,
        'media',
        'media.targetId = section.id AND media.targetType = :targetType',
        { targetType: IMAGE_PAGE_ENTITY_TYPE },
      );
      expect(qb.where).toHaveBeenCalledWith(
        'media.id = :mediaId AND media.mediaType IN (:...mediaTypes) AND page.id = :pageId',
        {
          mediaId: 'photo',
          mediaTypes: [MediaType.IMAGE, MediaType.VIDEO],
          pageId: 'feed',
        },
      );
      expect(result).toMatchObject({
        sectionPublic: true,
        pagePublic: false,
        mediaType,
      });
    },
  );
  it('normalizes both public flags from the database', async () => {
    qb.getRawOne.mockResolvedValue({ sectionPublic: 0, pagePublic: 1 });
    expect(
      await repository.findFeedPhotoContext('photo', 'feed'),
    ).toMatchObject({ sectionPublic: false, pagePublic: true });
  });
  it('returns null when media is missing or outside the feed', async () => {
    qb.getRawOne.mockResolvedValue(undefined);
    expect(await repository.findFeedPhotoContext('outside', 'feed')).toBeNull();
  });
});
