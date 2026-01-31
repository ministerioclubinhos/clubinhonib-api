import { Injectable, Logger } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { AwsS3Service } from 'src/shared/providers/aws/aws-s3.service';
import { MediaItemProcessor } from 'src/shared/media/media-item-processor';
import { UploadType } from 'src/shared/media/media-item/media-item.entity';
import { MediaTargetType } from 'src/shared/media/media-target-type.enum';
import { ImageSectionRepository } from '../repository/image-section.repository';
import { CreateImageSectionDto } from '../dto/create-image-section.dto';
import { MediaItemEntity } from 'src/shared/media/media-item/media-item.entity';
import { ImageSectionResponseDto } from '../dto/image-section-response.dto';
import { ImageSectionEntity } from 'src/modules/pages/image-page/entity/Image-section.entity';
import {
  AppInternalException,
  AppValidationException,
  ErrorCode,
} from 'src/shared/exceptions';

@Injectable()
export class ImageSectionCreateService {
  private readonly logger = new Logger(ImageSectionCreateService.name);

  constructor(
    private readonly dataSource: DataSource,
    private readonly awsS3Service: AwsS3Service,
    private readonly mediaItemProcessor: MediaItemProcessor,
    private readonly imageSectionRepository: ImageSectionRepository,
  ) {}

  async createSection(
    dto: CreateImageSectionDto,
    filesDict: Record<string, Express.Multer.File>,
  ): Promise<ImageSectionResponseDto> {
    this.logger.log(
      '🚀 Iniciando criação de seção órfã (sem página associada)',
    );

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const section = queryRunner.manager.create(ImageSectionEntity, {
        caption: dto.caption,
        description: dto.description,
        public: dto.public || false,
        page: null,
      });

      const savedSection = await queryRunner.manager.save(section);

      this.validateFiles(dto, filesDict);

      const preparedMediaItems = dto.mediaItems.map((item) => ({
        ...item,
        fileField: item.fieldKey,
      }));

      const mediaItems: MediaItemEntity[] =
        await this.mediaItemProcessor.processMediaItemsPolymorphic(
          preparedMediaItems,
          savedSection.id,
          MediaTargetType.ImagesPage,
          filesDict,
          (file: Express.Multer.File) => this.awsS3Service.upload(file),
        );

      await queryRunner.commitTransaction();

      return ImageSectionResponseDto.fromEntity(savedSection, mediaItems);
    } catch (error: unknown) {
      await queryRunner.rollbackTransaction();
      const errStack = error instanceof Error ? error.stack : undefined;
      this.logger.error('Erro ao criar seção', errStack);
      const hasCode = error && typeof error === 'object' && 'code' in error;
      if (hasCode) throw error as unknown as Error;
      throw new AppInternalException(
        ErrorCode.SECTION_CREATE_ERROR,
        'Erro ao criar a seção',
        error as Error,
      );
    } finally {
      await queryRunner.release();
    }
  }

  private validateFiles(
    dto: CreateImageSectionDto,
    filesDict: Record<string, Express.Multer.File>,
  ) {
    for (const media of dto.mediaItems) {
      if (media.uploadType === UploadType.UPLOAD && media.isLocalFile) {
        if (!media.originalName) {
          throw new AppValidationException(
            ErrorCode.MEDIA_FIELD_MISSING,
            'Campo originalName ausente',
          );
        }
        if (!media.fieldKey || !filesDict[media.fieldKey]) {
          throw new AppValidationException(
            ErrorCode.MEDIA_FILE_NOT_FOUND,
            `Arquivo não encontrado para fieldKey: ${media.fieldKey}`,
          );
        }
      }
    }
  }
}
