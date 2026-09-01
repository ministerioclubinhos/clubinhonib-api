import {
  IsArray,
  IsBoolean,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { MediaItemDto } from 'src/shared/share-dto/media-item-dto';

export class CreateIdeasSectionDto {
  @IsString({ message: 'O campo "title" da seção deve ser uma string.' })
  title: string;

  @IsString({ message: 'O campo "description" da seção deve ser uma string.' })
  description: string;

  @IsOptional()
  @IsBoolean({ message: 'O campo "public" da seção deve ser booleano.' })
  public?: boolean;

  @IsArray({ message: 'O campo "medias" deve ser um array.' })
  @ValidateNested({ each: true })
  @Type(() => MediaItemDto)
  medias: MediaItemDto[];
}

export class CreateIdeasPageDto {
  @IsString({ message: 'O campo "title" da página deve ser uma string.' })
  title: string;

  @IsOptional()
  @IsString({ message: 'O campo "subtitle" da página deve ser uma string.' })
  subtitle?: string;

  @IsString({ message: 'O campo "description" da página deve ser uma string.' })
  description: string;

  @IsOptional()
  @IsBoolean({ message: 'O campo "public" da página deve ser booleano.' })
  public?: boolean;

  @IsArray({ message: 'O campo "sections" deve ser um array.' })
  @ValidateNested({ each: true })
  @Type(() => CreateIdeasSectionDto)
  sections: CreateIdeasSectionDto[];
}
