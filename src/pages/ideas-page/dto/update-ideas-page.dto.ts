import {
  IsString,
  IsOptional,
  IsArray,
  ValidateNested,
  IsBoolean,
} from 'class-validator';
import { Type } from 'class-transformer';
import { MediaItemDto } from 'src/share/share-dto/media-item-dto';

export class IdeasSectionDto {
  @IsOptional()
  @IsString({ message: 'O campo "id" da seção deve ser uma string.' })
  id?: string;

  @IsString({ message: 'O campo "title" da seção deve ser uma string.' })
  title: string;

  @IsOptional()
  @IsBoolean({ message: 'O campo "public" da seção deve ser boolean.' })
  public?: boolean;

  @IsString({ message: 'O campo "description" da seção deve ser uma string.' })
  description: string;

  @IsOptional()
  @IsArray({ message: 'O campo "medias" deve ser um array.' })
  @ValidateNested({ each: true })
  @Type(() => MediaItemDto)
  medias: MediaItemDto[];
}

export class UpdateIdeasPageDto {
  @IsString({ message: 'O campo "id" da página deve ser uma string.' })
  id: string;

  @IsString({ message: 'O campo "title" da página deve ser uma string.' })
  title: string;
  
  @IsOptional()
  @IsString({ message: 'O campo "subtitle" da página deve ser uma string.' })
  subtitle?: string;

  @IsString({ message: 'O campo "description" da página deve ser uma string.' })
  description: string;

  @IsArray({ message: 'O campo "sections" deve ser um array.' })
  @ValidateNested({ each: true })
  @Type(() => IdeasSectionDto)
  sections: IdeasSectionDto[];
}
