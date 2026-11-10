import { DeleteIdeaAiAssetsService } from '../../ideas-section-ai/services/delete-idea-ai-assets.service';
import { Injectable, Logger } from '@nestjs/common';
import { EntityManager } from 'typeorm';
import {
  AppException,
  AppInternalException,
  ErrorCode,
} from 'src/shared/exceptions';
import { AwsS3Service } from 'src/shared/providers/aws/aws-s3.service';
import { DeleteRouteService } from 'src/modules/routes/services/delete-route.service';
import { MediaItemProcessor } from 'src/shared/media/media-item-processor';
import { IdeasPageRepository } from '../repositories/ideas-page.repository';
import { IdeasPageGetService } from './get-ideas-page.service';
import { collectSectionIds } from '../utils';
import {
  IDEAS_PAGE_ENTITY_TYPE,
  IDEAS_SECTION_MEDIA_TARGET_TYPE,
} from '../constants';

@Injectable()
export class IdeasPageDeleteService {
  private readonly logger = new Logger(IdeasPageDeleteService.name);

  constructor(
    private readonly aiAssets: DeleteIdeaAiAssetsService,
    private readonly ideasPageRepository: IdeasPageRepository,
    private readonly getService: IdeasPageGetService,
    private readonly deleteRouteService: DeleteRouteService,
    private readonly awsS3Service: AwsS3Service,
    private readonly mediaItemProcessor: MediaItemProcessor,
  ) {}

  async removePage(id: string): Promise<void> {
    const page = await this.getService.findEntityOrFail(id);

    try {
      const sectionIds = collectSectionIds([page]);

      const urls = await this.ideasPageRepository.runInTransaction(
        async (manager: EntityManager) => {
          const files: string[] = [];
          for (const sectionId of sectionIds) {
            files.push(...(await this.aiAssets.remove(sectionId, manager)));
            const media =
              await this.mediaItemProcessor.findMediaItemsByTargetInTransaction(
                manager,
                sectionId,
                IDEAS_SECTION_MEDIA_TARGET_TYPE,
              );
            files.push(...media.filter((m) => m.isLocalFile).map((m) => m.url));
            await this.mediaItemProcessor.deleteMediaItemsByTargetInTransaction(
              manager,
              sectionId,
              IDEAS_SECTION_MEDIA_TARGET_TYPE,
            );
          }
          await this.ideasPageRepository.removePage(page, manager);
          return files;
        },
      );
      await this.mediaItemProcessor.discardUnreferencedUploads(urls, (url) =>
        this.awsS3Service.delete(url),
      );

      if (page.route?.id) {
        await this.deleteRouteService.removeRoute(page.route.id);
      } else {
        await this.deleteRouteService.removeRouteByEntity(
          IDEAS_PAGE_ENTITY_TYPE,
          page.id,
        );
      }

      this.logger.log(`Página de ideias removida. ID=${id}`);
    } catch (error: unknown) {
      this.logger.error(
        `Erro ao remover página de ideias. ID=${id}`,
        error instanceof Error ? error.stack : undefined,
      );

      if (error instanceof AppException) throw error;
      throw new AppInternalException(
        ErrorCode.PAGE_DELETE_ERROR,
        'Erro ao remover a página de ideias',
        error as Error,
      );
    }
  }
}
