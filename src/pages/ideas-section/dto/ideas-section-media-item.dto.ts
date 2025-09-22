import {
  IsBoolean,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
} from 'class-validator';
import {
  PlatformType,
  UploadType,
} from 'src/share/media/media-item/media-item.entity';
import { IdeasSectionMediaType } from '../enums/ideas-section-media-type.enum';

export class IdeasSectionMediaItemDto {
  @IsOptional()
  @IsString({ message: 'O campo "id" da mídia deve ser uma string.' })
  id?: string;

  @IsOptional()
  @IsString({ message: 'O campo "title" da mídia deve ser uma string.' })
  title?: string;

  @IsOptional()
  @IsString({ message: 'O campo "description" da mídia deve ser uma string.' })
  description?: string;

  @IsEnum(UploadType, { message: 'O campo "uploadType" deve ser "upload" ou "link".' })
  uploadType: UploadType;

  @IsEnum(IdeasSectionMediaType, { 
    message: 'O campo "mediaType" deve ser "video", "document" ou "image".' 
  })
  mediaType: IdeasSectionMediaType;

  @IsBoolean({ message: 'O campo "isLocalFile" deve ser booleano.' })
  isLocalFile: boolean;

  @IsOptional()
  @IsString({ message: 'O campo "url" deve ser uma string.' })
  url?: string;

  @IsOptional()
  @IsEnum(PlatformType, { message: 'O campo "platformType" deve conter uma plataforma válida.' })
  platformType?: PlatformType;

  @IsOptional()
  @IsString({ message: 'O campo "originalName" deve ser uma string.' })
  originalName?: string;

  @IsOptional()
  @IsString({ message: 'O campo "fieldKey" deve ser uma string.' })
  fieldKey?: string;

  @IsOptional()
  @IsNumber({}, { message: 'O campo "size" deve ser um número.' })
  size?: number;

  @IsOptional()
  @IsString({ message: 'O campo "fileField" deve ser uma string.' })
  fileField?: string;
}
