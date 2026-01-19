import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { AwsS3Service } from 'src/shared/providers/aws/aws-s3.service';
import { MediaItemProcessor } from 'src/shared/media/media-item-processor';
import { MediaType, UploadType } from 'src/shared/media/media-item/media-item.entity';
import { GetUsersService } from './get-user.service';

@Injectable()
export class UpdateUserImageService {
  private readonly logger = new Logger(UpdateUserImageService.name);

  constructor(
    private readonly getUsersService: GetUsersService,
    private readonly mediaItemProcessor: MediaItemProcessor,
    private readonly s3Service: AwsS3Service,
  ) {}

  mapFiles(files: Express.Multer.File[]): Record<string, Express.Multer.File> {
    const filesDict: Record<string, Express.Multer.File> = {};
    files.forEach((file) => {
      filesDict[file.fieldname] = file;
    });
    return filesDict;
  }

  private validateImageFile(file: Express.Multer.File): void {
    if (!file.mimetype || !file.mimetype.startsWith('image/')) {
      throw new BadRequestException(
        `Tipo de arquivo inválido. Apenas imagens são permitidas. Tipo recebido: ${file.mimetype || 'desconhecido'}`,
      );
    }
  }

  async updateUserImage(
    userId: string,
    body: any,
    files: Express.Multer.File[],
  ) {
    await this.getUsersService.findOne(userId);

    let mediaDto: {
      title?: string;
      description?: string;
      uploadType?: UploadType;
      url?: string;
      isLocalFile?: boolean;
      fieldKey?: string;
    };

    if (body.imageData) {
      mediaDto = typeof body.imageData === 'string' 
        ? JSON.parse(body.imageData) 
        : body.imageData;
    } else if (body.title || body.url) {
      mediaDto = {
        title: body.title,
        description: body.description,
        uploadType: body.uploadType,
        url: body.url,
        isLocalFile: body.isLocalFile,
        fieldKey: body.fieldKey,
      };
    } else {
      throw new BadRequestException('imageData é obrigatório ou envie campos diretos (title, url, etc.)');
    }

    const filesDict = this.mapFiles(files);
    const hasFile = files.length > 0;

    let uploadTypeValue: UploadType;
    if (mediaDto.uploadType) {
      const normalized = String(mediaDto.uploadType).toLowerCase();
      uploadTypeValue = normalized === 'upload' ? UploadType.UPLOAD : UploadType.LINK;
    } else {
      uploadTypeValue = hasFile ? UploadType.UPLOAD : UploadType.LINK;
    }

    const existingMedia = await this.mediaItemProcessor.findMediaItemByTarget(
      userId,
      'UserEntity',
    );

    if (existingMedia) {
      const media = this.mediaItemProcessor.buildBaseMediaItem(
        {
          ...mediaDto,
          mediaType: MediaType.IMAGE,
          uploadType: uploadTypeValue,
        },
        userId,
        'UserEntity',
      );

      const hasOldLocalFile = existingMedia.isLocalFile && existingMedia.url;

      if (hasFile) {
        const fieldKey = mediaDto.fieldKey || 'file';
        const file = filesDict[fieldKey];
        if (!file) {
          throw new BadRequestException(
            `Arquivo não encontrado para upload. FieldKey: ${fieldKey}, Arquivos disponíveis: ${Object.keys(filesDict).join(', ')}`,
          );
        }

        this.validateImageFile(file);

        if (hasOldLocalFile) {
          try {
            await this.s3Service.delete(existingMedia.url);
            this.logger.log(`Arquivo antigo deletado do S3: ${existingMedia.url}`);
          } catch (error) {
            this.logger.warn(`Não foi possível deletar o arquivo antigo do S3: ${existingMedia.url}`, error);
          }
        }

        media.uploadType = UploadType.UPLOAD;
        media.url = await this.s3Service.upload(file);
        media.isLocalFile = true;
        media.originalName = file.originalname;
        media.size = file.size;
      } else if (mediaDto.url) {
        if (hasOldLocalFile) {
          try {
            await this.s3Service.delete(existingMedia.url);
            this.logger.log(`Arquivo antigo deletado do S3 ao mudar para link: ${existingMedia.url}`);
          } catch (error) {
            this.logger.warn(`Não foi possível deletar o arquivo antigo do S3: ${existingMedia.url}`, error);
          }
        }

        media.uploadType = UploadType.LINK;
        media.url = mediaDto.url;
        media.isLocalFile = false;
      } else {
        throw new BadRequestException('URL ou arquivo é obrigatório');
      }

      await this.mediaItemProcessor.upsertMediaItem(existingMedia.id, media);
    } else {
      const media = this.mediaItemProcessor.buildBaseMediaItem(
        {
          ...mediaDto,
          mediaType: MediaType.IMAGE,
          uploadType: uploadTypeValue,
          title: mediaDto.title || 'Foto do Usuário',
          description: mediaDto.description || 'Imagem de perfil do usuário',
        },
        userId,
        'UserEntity',
      );

      if (hasFile) {
        const fieldKey = mediaDto.fieldKey || 'file';
        const file = filesDict[fieldKey];
        if (!file) {
          throw new BadRequestException(
            `Arquivo não encontrado para upload. FieldKey: ${fieldKey}, Arquivos disponíveis: ${Object.keys(filesDict).join(', ')}`,
          );
        }

        this.validateImageFile(file);

        media.uploadType = UploadType.UPLOAD;
        media.url = await this.s3Service.upload(file);
        media.isLocalFile = true;
        media.originalName = file.originalname;
        media.size = file.size;
      } else if (mediaDto.url) {
        media.uploadType = UploadType.LINK;
        media.url = mediaDto.url;
        media.isLocalFile = false;
      } else {
        throw new BadRequestException('URL ou arquivo é obrigatório');
      }

      await this.mediaItemProcessor.saveMediaItem(media);
    }

    return this.getUsersService.findOne(userId);
  }
}

