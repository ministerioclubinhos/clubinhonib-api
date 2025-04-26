import {
  IsArray,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { MediaItemDto } from 'src/share/share-dto/media-item-dto';

export class CreateWeekMaterialsPageDto {
  @IsString({ message: 'O campo "pageTitle" deve ser uma string.' })
  pageTitle: string;

  @IsString({ message: 'O campo "pageSubtitle" deve ser uma string.' })
  pageSubtitle: string;

  @IsString({ message: 'O campo "pageDescription" deve ser uma string.' })
  pageDescription: string;

  @IsOptional()
  @IsArray({ message: 'O campo "videos" deve ser um array.' })
  @ValidateNested({ each: true })
  @Type(() => MediaItemDto)
  videos?: MediaItemDto[];

  @IsOptional()
  @IsArray({ message: 'O campo "documents" deve ser um array.' })
  @ValidateNested({ each: true })
  @Type(() => MediaItemDto)
  documents?: MediaItemDto[];

  @IsOptional()
  @IsArray({ message: 'O campo "images" deve ser um array.' })
  @ValidateNested({ each: true })
  @Type(() => MediaItemDto)
  images?: MediaItemDto[];

  @IsOptional()
  @IsArray({ message: 'O campo "audios" deve ser um array.' })
  @ValidateNested({ each: true })
  @Type(() => MediaItemDto)
  audios?: MediaItemDto[];
}