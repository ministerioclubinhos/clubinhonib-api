import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { AwsS3Service } from 'src/aws/aws-s3.service';
import { MediaItemProcessor } from 'src/share/media/media-item-processor';
import { UploadType } from 'src/share/media/media-item/media-item.entity';
import { MediaTargetType } from 'src/share/media/media-target-type.enum';
import { ImageSectionRepository } from '../repository/image-section.repository';
import { CreateImageSectionDto } from '../dto/create-image-section.dto';
import { MediaItemEntity } from 'src/share/media/media-item/media-item.entity';
import { ImageSectionResponseDto } from '../dto/image-section-response.dto';
import { ImageSectionEntity } from 'src/pages/image-page/entity/Image-section.entity';

@Injectable()
export class ImageSectionCreateService {
  private readonly logger = new Logger(ImageSectionCreateService.name);

  constructor(
    private readonly dataSource: DataSource,
    private readonly awsS3Service: AwsS3Service,
    private readonly mediaItemProcessor: MediaItemProcessor,
    private readonly imageSectionRepository: ImageSectionRepository,
  ) { }

  async createSection(
    dto: CreateImageSectionDto,
    filesDict: Record<string, Express.Multer.File>,
  ): Promise<ImageSectionResponseDto> {
    this.logger.log('🚀 Iniciando criação de seção órfã (sem página associada)');

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

      const preparedMediaItems = dto.mediaItems.map(item => ({
        ...item,
        fileField: item.fieldKey,
      }));

      const mediaItems: MediaItemEntity[] = await this.mediaItemProcessor.processMediaItemsPolymorphic(
        preparedMediaItems,
        savedSection.id,
        MediaTargetType.ImagesPage,
        filesDict,
        this.awsS3Service.upload.bind(this.awsS3Service),
      );

      await queryRunner.commitTransaction();

      return ImageSectionResponseDto.fromEntity(savedSection, mediaItems);
    } catch (error) {
      await queryRunner.rollbackTransaction();
      this.logger.error('❌ Erro ao criar seção', error);
      throw new BadRequestException('Erro ao criar a seção');
    } finally {
      await queryRunner.release();
    }
  }

  private validateFiles(dto: CreateImageSectionDto, filesDict: Record<string, Express.Multer.File>) {
    for (const media of dto.mediaItems) {
      if (media.uploadType === UploadType.UPLOAD && media.isLocalFile) {
        if (!media.originalName) {
          throw new BadRequestException('Campo originalName ausente');
        }
        if (!media.fieldKey || !filesDict[media.fieldKey]) {
          throw new BadRequestException(`Arquivo não encontrado para fieldKey: ${media.fieldKey}`);
        }
      }
    }
  }
}
