import {
  IsArray,
  ArrayMinSize,
  Matches,
  MaxLength,
  IsBoolean,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { IDEAS_PAGE_MIN_SECTIONS, IDEAS_TITLE_MAX_LENGTH } from '../constants';
import { MediaItemDto } from 'src/shared/share-dto/media-item-dto';

export class UpdateIdeasSectionDto {
  /** Ausente quando a seção está sendo criada dentro de uma página existente. */
  @IsOptional()
  @IsString({ message: 'O campo "id" da seção deve ser uma string.' })
  id?: string;

  @IsString({ message: 'O campo "title" da seção deve ser uma string.' })
  @Matches(/\S/, { message: 'O título não pode ficar vazio.' })
  @MaxLength(IDEAS_TITLE_MAX_LENGTH, { message: 'Use até 255 caracteres.' })
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

export class UpdateIdeasPageDto {
  /**
   * O cliente reenvia o id da página no corpo. O caso de uso usa sempre o id da
   * rota; este campo existe só para não recusar o payload já em uso.
   */
  @IsOptional()
  @IsString({ message: 'O campo "id" da página deve ser uma string.' })
  id?: string;

  @IsString({ message: 'O campo "title" da página deve ser uma string.' })
  @Matches(/\S/, { message: 'O título não pode ficar vazio.' })
  @MaxLength(IDEAS_TITLE_MAX_LENGTH, { message: 'Use até 255 caracteres.' })
  title: string;

  @IsOptional()
  @IsString({ message: 'O campo "subtitle" da página deve ser uma string.' })
  @MaxLength(IDEAS_TITLE_MAX_LENGTH, { message: 'Use até 255 caracteres.' })
  subtitle?: string;

  @IsString({ message: 'O campo "description" da página deve ser uma string.' })
  @Matches(/\S/, { message: 'A descrição da página não pode ficar vazia.' })
  description: string;

  @IsOptional()
  @IsBoolean({ message: 'O campo "public" da página deve ser booleano.' })
  public?: boolean;

  @IsArray({ message: 'O campo "sections" deve ser um array.' })
  @ArrayMinSize(IDEAS_PAGE_MIN_SECTIONS, {
    message: 'Adicione ao menos uma seção.',
  })
  @ValidateNested({ each: true })
  @Type(() => UpdateIdeasSectionDto)
  sections: UpdateIdeasSectionDto[];
}
