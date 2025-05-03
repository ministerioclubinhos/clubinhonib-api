import {
    IsArray,
    IsBoolean,
    IsEnum,
    IsOptional,
    IsString,
    ValidateNested,
    IsUrl,
  } from 'class-validator';
  import { Type } from 'class-transformer';
  import {
    PlatformType,
    MediaType,
    UploadType,
  } from 'src/share/media/media-item/media-item.entity';
  
  export class IdeasMediaItemDto {
    @IsString({ message: 'O campo "title" deve ser uma string.' })
    title: string;
  
    @IsString({ message: 'O campo "description" deve ser uma string.' })
    description: string;
  
    @IsEnum(MediaType, {
      message: 'O campo "type" deve ser "video", "document" ou "image".',
    })
    mediaType: MediaType;
  
    @IsEnum(UploadType, {
      message: 'O campo "uploadType" deve ser "upload" ou "link".',
    })
    uploadType: UploadType;
  
    @IsBoolean({ message: 'O campo "isLocalFile" deve ser booleano.' })
    isLocalFile: boolean;
  
    @IsOptional()
    @IsUrl(undefined, { message: 'O campo "url" deve conter uma URL válida.' })
    url?: string;
  
    @IsOptional()
    @IsEnum(PlatformType, {
      message: 'O campo "platformType" deve conter uma plataforma válida.',
    })
    platformType?: PlatformType;
  
    @IsOptional()
    @IsString({ message: 'O campo "originalName" deve ser uma string.' })
    originalName?: string;
  
    @IsOptional()
    @IsString({ message: 'O campo "fieldKey" deve ser uma string.' })
    fieldKey?: string;
  
    @IsOptional()
    @IsString({ message: 'O campo "size" deve ser uma string.' })
    size?: string;
  }
  
  export class IdeasSectionDto {
    @IsString({ message: 'O campo "title" deve ser uma string.' })
    title: string;
  
    @IsString({ message: 'O campo "description" deve ser uma string.' })
    description: string;
  
    @IsOptional()
    @IsBoolean({ message: 'O campo "public" deve ser booleano.' })
    public?: boolean;
  
    @IsArray({ message: 'O campo "medias" deve ser um array.' })
    @ValidateNested({ each: true })
    @Type(() => IdeasMediaItemDto)
    medias: IdeasMediaItemDto[];
  }
  
  export class CreateIdeasPageDto {
    @IsString({ message: 'O campo "title" deve ser uma string.' })
    title: string;
    
    @IsOptional()
    @IsString({ message: 'O campo "subtitle" deve ser uma string.' })
    subtitle?: string;
  
    @IsString({ message: 'O campo "description" deve ser uma string.' })
    description: string;
  
    @IsOptional()
    @IsBoolean({ message: 'O campo "public" deve ser booleano.' })
    public?: boolean = true;
  
    @IsArray({ message: 'O campo "sections" deve ser um array.' })
    @ValidateNested({ each: true })
    @Type(() => IdeasSectionDto)
    sections: IdeasSectionDto[];
  }
  