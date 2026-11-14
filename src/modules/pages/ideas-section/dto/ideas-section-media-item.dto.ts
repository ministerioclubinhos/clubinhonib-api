import {
  IsBoolean,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';
import {
  PlatformType,
  UploadType,
} from 'src/shared/media/media-item/media-item.entity';
import { IdeasSectionMediaType } from '../entities/ideas-section-media-type.enum';

export class IdeasSectionMediaItemDto {
  @IsOptional()
  @IsString({ message: 'O campo "id" da mídia deve ser uma string.' })
  id?: string;

  /** Ignorado na submissão do professor; o servidor gera o título. */
  @IsOptional()
  @IsString({ message: 'O campo "title" da mídia deve ser uma string.' })
  title?: string;

  /** Ignorada na submissão do professor; o servidor gera descrição vazia. */
  @IsOptional()
  @IsString({ message: 'O campo "description" da mídia deve ser uma string.' })
  description?: string;

  @IsEnum(UploadType, {
    message: 'O campo "uploadType" deve ser "upload" ou "link".',
  })
  uploadType: UploadType;

  @IsEnum(IdeasSectionMediaType, {
    message: 'O campo "mediaType" deve ser "video", "document" ou "image".',
  })
  mediaType: IdeasSectionMediaType;

  @IsBoolean({ message: 'O campo "isLocalFile" deve ser booleano.' })
  isLocalFile: boolean;

  @IsOptional()
  @IsString({ message: 'O campo "url" deve ser uma string.' })
  @MaxLength(2048, { message: 'A URL deve ter no máximo 2048 caracteres.' })
  url?: string;

  @IsOptional()
  @IsEnum(PlatformType, {
    message: 'O campo "platformType" deve conter uma plataforma válida.',
  })
  platformType?: PlatformType;

  @IsOptional()
  @IsString({ message: 'O campo "originalName" deve ser uma string.' })
  originalName?: string;

  /**
   * Campo do multipart que carrega o arquivo desta mídia.
   *
   * É o que religa arquivo e mídia do outro lado. O nome interno usado pelo
   * processador (`fileField`) sai daqui e não é aceito na requisição.
   */
  @IsOptional()
  @IsString({ message: 'O campo "fieldKey" deve ser uma string.' })
  fieldKey?: string;

  @IsOptional()
  @IsNumber({}, { message: 'O campo "size" deve ser um número.' })
  size?: number;
}
