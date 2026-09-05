import { Injectable, Logger } from '@nestjs/common';
import { AppInternalException, ErrorCode } from 'src/shared/exceptions';
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

@Injectable()
export class UpdateIdeasSectionService {
  private readonly logger = new Logger(UpdateIdeasSectionService.name);

  constructor(
    private readonly sectionRepo: IdeasSectionsRepository,
    private readonly awsS3Service: AwsS3Service,
    private readonly mediaItemProcessor: MediaItemProcessor,
    private readonly mediaService: IdeasSectionMediaService,
    private readonly getService: GetIdeasSectionsService,
  ) {}

  /** Edita a ideia sem mexer em onde ela está publicada. */
  async updateSection(
    id: string,
    dto: UpdateIdeasSectionDto,
    filesDict: UploadedFilesDict,
  ): Promise<IdeasSectionResponseDto> {
    const existing = await this.getService.findEntityOrFail(id);
    assertUploadsHaveFiles(dto.medias, filesDict);

    // Os arquivos sobem fora da transação: o rastreador permite apagá-los do
    // bucket quando a edição falha depois do upload.
    const uploads = new S3UploadTracker((file: Express.Multer.File) =>
      this.awsS3Service.upload(file),
    );

    try {
      // A transação é aberta pelo repositório; aqui só se decide o que entra
      // nela. O rollback acontece sozinho quando o bloco lança.
      const { saved, processedMedia } = await this.sectionRepo.runInTransaction(
        async (manager) => {
          const existingMedia = await this.mediaService.findExisting(
            id,
            manager,
          );

          // O `id` vai junto: sem ele o `save` inseria uma linha nova e
          // deixava a original intacta, duplicando a ideia a cada edição.
          const section = await this.sectionRepo.saveInTransaction(manager, {
            id: existing.id,
            title: dto.title,
            description: dto.description,
            public: dto.public ?? existing.public,
            page: existing.page ?? undefined,
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

          return { saved: section, processedMedia: media };
        },
      );

      this.logger.log(`Ideia compartilhada atualizada. ID=${id}`);

      return toIdeasSectionResponse(
        { ...saved, page: existing.page } as IdeasSectionEntity,
        processedMedia,
      );
    } catch (error: unknown) {
      await this.mediaItemProcessor.discardUnreferencedUploads(
        uploads.uploadedUrls,
        (url: string) => this.awsS3Service.delete(url),
      );

      this.logger.error(
        `Erro ao atualizar ideia compartilhada. ID=${id}`,
        error instanceof Error ? error.stack : undefined,
      );

      // Erro do domínio sobe como está; só o inesperado vira interno.
      if (error instanceof Error && 'code' in error) throw error;
      throw new AppInternalException(
        ErrorCode.SECTION_UPDATE_ERROR,
        'Erro ao atualizar a ideia compartilhada',
        error instanceof Error ? error : new Error(String(error)),
      );
    }
  }
}
