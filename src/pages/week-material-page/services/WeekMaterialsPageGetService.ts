import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { WeekMaterialsPageRepository } from '../week-material.repository';
import { MediaItemProcessor } from 'src/share/media/media-item-processor';
import { WeekMaterialsPageResponseDTO } from '../dto/week-material-response.dto';
import { WeekMaterialsPageEntity } from '../entities/week-material-page.entity';
import { MediaTargetType } from 'src/share/media/media-target-type.enum';
import { MediaItemEntity } from 'src/share/media/media-item/media-item.entity';

@Injectable()
export class WeekMaterialsPageGetService {
  private readonly logger = new Logger(WeekMaterialsPageGetService.name);

  constructor(
    private readonly repo: WeekMaterialsPageRepository,
    private readonly mediaItemProcessor: MediaItemProcessor,
  ) { }

  async findAllPages(): Promise<WeekMaterialsPageEntity[]> {
    this.logger.debug('📥 Buscando todas as páginas');
    return this.repo.findAllPages();
  }

  async findOnePage(id: string): Promise<WeekMaterialsPageEntity> {
    this.logger.debug(`📄 Buscando página ID=${id}`);
    const page = await this.repo.findOnePageById(id);
    if (!page) throw new NotFoundException('Página não encontrada');
    return page;
  }

  async findPageWithMedia(id: string): Promise<WeekMaterialsPageResponseDTO> {
    this.logger.debug(`🔍 Buscando página com mídias ID=${id}`);
    const page = await this.findOnePage(id);
    const mediaItems = await this.mediaItemProcessor.findMediaItemsByTarget(
      page.id,
      MediaTargetType.WeekMaterialsPage,
    );
    return WeekMaterialsPageResponseDTO.fromEntity(page, mediaItems);
  }

  async findAllPagesWithMedia(): Promise<WeekMaterialsPageResponseDTO[]> {
    this.logger.debug('📥 Buscando todas as páginas com mídias');
    const pages = await this.repo.findAllPages();
    const pageIds = pages.map((p) => p.id);
    const allMedia = await this.mediaItemProcessor.findManyMediaItemsByTargets(
      pageIds,
      MediaTargetType.WeekMaterialsPage,
    );

    const grouped = pageIds.reduce((acc, id) => {
      acc[id] = allMedia.filter((m) => m.targetId === id);
      return acc;
    }, {} as Record<string, MediaItemEntity[]>);

    return pages.map((page) =>
      WeekMaterialsPageResponseDTO.fromEntity(page, grouped[page.id] || []),
    );
  }

  async setCurrentWeek(id: string): Promise<any> {
    this.logger.debug('📥 Iniciando processo para definir "material da semana atual"...');

    try {
      this.logger.debug(`🔎 Buscando página pelo ID: ${id}`);
      const weekPage = await this.repo.findOnePageById(id);

      if (!weekPage) {
        this.logger.warn(`⚠️ Nenhuma página encontrada com ID: ${id}`);
        throw new Error(`Página com ID ${id} não encontrada.`);
      }

      this.logger.debug(`📄 Página alvo encontrada: ${weekPage.id} - ${weekPage.title}`);

      const weekPageCurrent = await this.repo.findCurrentWeek();
      if (weekPageCurrent) {
        this.logger.debug(`📌 Página atual marcada como "semana atual": ${weekPageCurrent.id} - ${weekPageCurrent.title}`);
      } else {
        this.logger.debug('ℹ️ Nenhuma página estava marcada como atual.');
      }

      if (weekPageCurrent && weekPageCurrent.id !== weekPage.id) {
        this.logger.debug(`🧼 Limpando flag "currentWeek" da página anterior: ${weekPageCurrent.id}`);
        weekPageCurrent.currentWeek = false;
        weekPageCurrent.route.current = false;
        await this.repo.savePage(weekPageCurrent);
        this.logger.debug(`✅ Página ${weekPageCurrent.id} atualizada com currentWeek=false`);
      }

      this.logger.debug(`🏁 Atualizando página ${weekPage.id} para currentWeek=true`);
      weekPage.currentWeek = true;
      weekPage.route.current = true;
      weekPage.route.public = true;

      await this.repo.savePage(weekPage);
      this.logger.debug(`✅ Página ${weekPage.id} marcada como material da semana atual.`);

    } catch (error) {
      this.logger.error(`❌ Erro ao definir página como atual: ${error.message}`, error.stack);
      throw error;
    }
  }

  async getCurrentWeek(): Promise<WeekMaterialsPageEntity | { message: string }> {
    this.logger.debug(`📄 Buscando página de material da semana atual`);
    const page = await this.repo.findCurrentWeek();
    if (!page) {
      this.logger.debug('Nenhuma página da semana atual encontrada');
      return { message: 'Nenhuma página da semana atual encontrada.' };
    }
    return page;
  }

}