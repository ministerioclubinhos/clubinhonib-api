import {
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { IdeasPageRepository } from '../repositories/ideas-page.repository';
import { MediaItemProcessor } from 'src/share/media/media-item-processor';
import { MediaTargetType } from 'src/share/media/media-target-type.enum';
import { IdeasPageResponseDto } from '../dto/ideas-page-response.dto';
import { IdeasPageEntity } from '../entities/ideas-page.entity';
import { MediaItemEntity } from 'src/share/media/media-item/media-item.entity';

@Injectable()
export class IdeasPageGetService {
  private readonly logger = new Logger(IdeasPageGetService.name);

  constructor(
    private readonly pageRepo: IdeasPageRepository,
    private readonly mediaProcessor: MediaItemProcessor,
  ) {}

  async findOne(id: string): Promise<IdeasPageEntity> {
    const page = await this.pageRepo.findOnePageById(id);
    if (!page) throw new NotFoundException('Página não encontrada');
    return page;
  }

  async findAll(): Promise<IdeasPageEntity[]> {
    return this.pageRepo.findAllPagesWithSections();
  }

  async findPageWithMedia(id: string): Promise<IdeasPageResponseDto> {
    const page = await this.findOne(id);

    const sectionIds = page.sections.map((s) => s.id);
    const media = await this.mediaProcessor.findManyMediaItemsByTargets(
      sectionIds,
      MediaTargetType.IdeasSection,
    );

    const map = this.groupByTarget(media);
    return IdeasPageResponseDto.fromEntity(page, map);
  }

  async findAllPagesWithMedia(): Promise<IdeasPageResponseDto[]> {
    const pages = await this.pageRepo.findAllPagesWithSections();
    const allSectionIds = pages.flatMap((p) => p.sections.map((s) => s.id));

    const allMedia = await this.mediaProcessor.findManyMediaItemsByTargets(
      allSectionIds,
      MediaTargetType.IdeasSection,
    );
    const map = this.groupByTarget(allMedia);

    return pages.map((p) => IdeasPageResponseDto.fromEntity(p, map));
  }

  private groupByTarget(
    media: MediaItemEntity[],
  ): Map<string, MediaItemEntity[]> {
    return media.reduce((acc, item) => {
      const arr = acc.get(item.targetId) || [];
      arr.push(item);
      acc.set(item.targetId, arr);
      return acc;
    }, new Map<string, MediaItemEntity[]>());
  }
}
