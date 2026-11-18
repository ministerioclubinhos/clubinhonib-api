import {
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { MediaItemDto } from 'src/shared/share-dto/media-item-dto';
import { IMAGE_PAGE_MIN_SECTIONS, IMAGE_TITLE_MAX_LENGTH } from '../constants';

export class UpdateSectionDto {
  @IsOptional()
  @IsString({ message: 'O campo "id" da seção deve ser uma string.' })
  id?: string;

  @IsString({ message: 'O campo "caption" da seção deve ser uma string.' })
  @MaxLength(IMAGE_TITLE_MAX_LENGTH, { message: 'Use até 255 caracteres.' })
  caption: string;

  @IsString({ message: 'O campo "description" da seção deve ser uma string.' })
  description: string;

  @IsBoolean({ message: 'O campo "public" da seção deve ser booleano.' })
  public: boolean;

  @IsArray({ message: 'O campo "mediaItems" deve ser um array.' })
  @ValidateNested({ each: true })
  @Type(() => MediaItemDto)
  mediaItems: MediaItemDto[];
}

export class UpdateImagePageDto {
  @IsString({ message: 'O campo "id" da galeria deve ser uma string.' })
  id: string;

  @IsString({ message: 'O campo "title" da galeria deve ser uma string.' })
  @Matches(/\S/, { message: 'O título não pode ficar vazio.' })
  @MaxLength(IMAGE_TITLE_MAX_LENGTH, { message: 'Use até 255 caracteres.' })
  title: string;

  @IsString({
    message: 'O campo "description" da galeria deve ser uma string.',
  })
  @Matches(/\S/, { message: 'A descrição da galeria não pode ficar vazia.' })
  description: string;

  @IsBoolean({ message: 'O campo "public" da galeria deve ser booleano.' })
  public: boolean;

  @IsArray({ message: 'O campo "sections" deve ser um array.' })
  @ArrayMinSize(IMAGE_PAGE_MIN_SECTIONS, {
    message: 'Adicione ao menos uma seção.',
  })
  @ValidateNested({ each: true })
  @Type(() => UpdateSectionDto)
  sections: UpdateSectionDto[];
}
