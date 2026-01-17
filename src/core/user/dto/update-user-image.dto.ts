import { IsOptional, IsString, IsBoolean, IsEnum } from 'class-validator';
import { UploadType } from 'src/shared/media/media-item/media-item.entity';

/**
 * DTO para receber dados de atualização de imagem de usuário via form-data ou JSON
 * 
 * Pode receber:
 * - imageData: string JSON (quando vem como form-data)
 * - Campos diretos (title, url, etc.) quando vem como JSON puro
 */
export class UpdateUserImageDto {
  /**
   * Quando vem como form-data, os dados da imagem vêm como string JSON neste campo
   */
  @IsOptional()
  @IsString()
  imageData?: string | {
    title?: string;
    description?: string;
    uploadType?: UploadType;
    url?: string;
    isLocalFile?: boolean;
    fieldKey?: string;
  };

  /**
   * Campos diretos (usado quando vem como JSON puro ou form-data com campos separados)
   */
  @IsOptional()
  @IsString()
  title?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsEnum(UploadType)
  uploadType?: UploadType;

  @IsOptional()
  @IsString()
  url?: string;

  @IsOptional()
  @IsBoolean()
  isLocalFile?: boolean;

  @IsOptional()
  @IsString()
  fieldKey?: string;
}

