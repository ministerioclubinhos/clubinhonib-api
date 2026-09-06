import { Injectable, Logger } from '@nestjs/common';
import {
  AppBusinessException,
  AppInternalException,
  AppNotFoundException,
  ErrorCode,
} from 'src/shared/exceptions';
import { AwsS3Service } from 'src/shared/providers/aws/aws-s3.service';
import { MediaItemProcessor } from 'src/shared/media/media-item-processor';
import { S3UploadTracker } from 'src/shared/media/s3-upload-tracker';
import { IdeasSectionEntity } from 'src/modules/pages/ideas-page/entities/ideas-section.entity';

import { IdeasSectionsRepository } from '../repositories/ideas-sections.repository';

import { UpdateIdeasSectionDto } from '../dto/update-ideas-section.dto';
import { IdeasSectionResponseDto } from '../dto/ideas-section-response.dto';
import { toIdeasSectionResponse } from '../mappers';
import { assertUploadsHaveFiles } from '../utils';
import { UploadedFilesDict } from '../types';
import { GetIdeasSectionsService } from './get-ideas-sections.service';
import { IdeasSectionMediaService } from './ideas-section-media.service';

/**
 * Aceita uma ideia compartilhada e a publica em uma página.
 *
 * É o passo final da fila: a administração revisa o texto e as mídias, escolhe
 * a página e a ideia deixa de estar pendente.
 */
@Injectable()
export class AttachIdeasSectionService {
  private readonly logger = new Logger(AttachIdeasSectionService.name);

  constructor(
    private readonly sectionRepo: IdeasSectionsRepository,
    private readonly awsS3Service: AwsS3Service,
    private readonly mediaItemProcessor: MediaItemProcessor,
    private readonly mediaService: IdeasSectionMediaService,
    private readonly getService: GetIdeasSectionsService,
  ) {}

  async attachToPage(
    sectionId: string,
    pageId: string,
    dto: UpdateIdeasSectionDto,
    filesDict: UploadedFilesDict,
  ): Promise<IdeasSectionResponseDto> {
    const existing = await this.getService.findEntityOrFail(sectionId);

    if (existing.page) {
      throw new AppBusinessException(
        ErrorCode.SECTION_UPDATE_ERROR,
        'Esta ideia já foi publicada em uma página.',
      );
    }

    // Só a mídia nova precisa vir com arquivo; a já gravada volta apenas com o
    // id e a URL, e o serviço de mídia decide se a reaproveita.
    assertUploadsHaveFiles(
      dto.medias?.filter((media) => !media.id),
      filesDict,
    );

    const uploads = new S3UploadTracker((file: Express.Multer.File) =>
      this.awsS3Service.upload(file),
    );

    try {
      // A transação é aberta pelo repositório; aqui só se decide o que entra
      // nela. O rollback acontece sozinho quando o bloco lança.
      const { saved, page, processedMedia } =
        await this.sectionRepo.runInTransaction(async (manager) => {
          const ideasPage = await this.sectionRepo.findPageById(
            manager,
            pageId,
          );

          if (!ideasPage) {
            throw new AppNotFoundException(
              ErrorCode.RESOURCE_NOT_FOUND,
              'Página de ideias não encontrada',
            );
          }

          const existingMedia = await this.mediaService.findExisting(
            sectionId,
            manager,
          );

          // O `id` vai junto: sem ele o `save` criava uma seção nova ligada à
          // página e deixava a original parada na fila para sempre.
          const section = await this.sectionRepo.saveInTransaction(manager, {
            id: existing.id,
            title: dto.title,
            description: dto.description,
            public: dto.public ?? existing.public,
            page: ideasPage,
          });

          await this.mediaService.deleteMedia(
            existingMedia,
            dto.medias ?? [],
            manager,
          );
          const media = await this.mediaService.processSectionMedia(
            dto.medias ?? [],
            section.id,
            existingMedia,
            filesDict,
            manager,
            uploads,
          );

          return { saved: section, page: ideasPage, processedMedia: media };
        });

      this.logger.log(
        `Ideia compartilhada publicada. ID=${sectionId} página=${pageId}`,
      );

      return toIdeasSectionResponse(
        { ...saved, page } as IdeasSectionEntity,
        processedMedia,
      );
    } catch (error: unknown) {
      await this.mediaItemProcessor.discardUnreferencedUploads(
        uploads.uploadedUrls,
        (url: string) => this.awsS3Service.delete(url),
      );

      this.logger.error(
        `Erro ao publicar ideia compartilhada. ID=${sectionId}`,
        error instanceof Error ? error.stack : undefined,
      );

      // Erro do domínio sobe como está. A versão anterior envolvia tudo em um
      // erro interno, então "página não encontrada" chegava como 500.
      if (error instanceof Error && 'code' in error) throw error;
      throw new AppInternalException(
        ErrorCode.SECTION_UPDATE_ERROR,
        'Erro ao publicar a ideia compartilhada',
        error instanceof Error ? error : new Error(String(error)),
      );
    }
  }
}
