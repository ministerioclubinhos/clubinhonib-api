import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { IdeasSectionRepository } from '../repository/ideas-section.repository';
import { IdeasSectionEntity } from 'src/pages/ideas-page/entities/ideas-section.entity';
import { IdeasSectionResponseDto } from '../dto/ideas-section-response.dto';
import { MediaItemEntity } from 'src/share/media/media-item/media-item.entity';
import { MediaItemProcessor } from 'src/share/media/media-item-processor';
import { MediaTargetType } from 'src/share/media/media-target-type.enum';

@Injectable()
export class IdeasSectionGetService {
  private readonly logger = new Logger(IdeasSectionGetService.name);

  constructor(
    private readonly ideasSectionRepository: IdeasSectionRepository,
    private readonly mediaItemProcessor: MediaItemProcessor,
  ) { }

  async findOne(id: string): Promise<IdeasSectionResponseDto | null> {
    this.logger.debug(`🔍 Buscando seção de ideias ID=${id}`);

    const section = await this.ideasSectionRepository.findOne({
      where: { id },
    });

    if (!section) {
      this.logger.warn(`⚠️ Seção de ideias ID=${id} não encontrada`);
      return null;
    }

    const medias = await this.mediaItemProcessor.findManyMediaItemsByTargets(
      [id],
      MediaTargetType.IdeasSection,
    );

    this.logger.debug(`✅ Seção de ideias encontrada: ID=${id}, title="${section.title}"`);
    return IdeasSectionResponseDto.fromEntity(section, medias);
  }

  async findAll(): Promise<IdeasSectionResponseDto[]> {
    this.logger.debug('🔍 Buscando todas as seções de ideias órfãs');

    const sections = await this.ideasSectionRepository.findAllOrphanSections();

    if (!sections || sections.length === 0) {
      this.logger.debug('📭 Nenhuma seção de ideias órfã encontrada');
      return [];
    }

    const sectionIds = sections.map(section => section.id);
    const allMedias = await this.mediaItemProcessor.findManyMediaItemsByTargets(
      sectionIds,
      MediaTargetType.IdeasSection,
    );

    const mediaMap = this.groupMediaBySectionId(allMedias);

    const result = sections.map(section => {
      const sectionMedias = mediaMap.get(section.id) || [];
      return IdeasSectionResponseDto.fromEntity(section, sectionMedias);
    });

    this.logger.debug(`✅ ${result.length} seções de ideias órfãs encontradas`);
    return result;
  }

  private groupMediaBySectionId(mediaItems: MediaItemEntity[]): Map<string, MediaItemEntity[]> {
    const mediaMap = new Map<string, MediaItemEntity[]>();

    for (const media of mediaItems) {
      const sectionId = media.targetId;
      if (!mediaMap.has(sectionId)) {
        mediaMap.set(sectionId, []);
      }
      mediaMap.get(sectionId)!.push(media);
    }

    return mediaMap;
  }
}
