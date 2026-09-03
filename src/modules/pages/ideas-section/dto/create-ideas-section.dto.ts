import { IsArray, IsString, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { IdeasSectionMediaItemDto } from './ideas-section-media-item.dto';

/**
 * Ideia enviada pela base.
 *
 * `public` não entra aqui: a ideia nasce fora do ar e quem decide publicá-la é
 * a administração, na revisão. Aceitá-lo deixaria quem envia publicar sozinho.
 */
export class CreateIdeasSectionDto {
  @IsString({ message: 'O campo "title" deve ser uma string.' })
  title: string;

  @IsString({ message: 'O campo "description" deve ser uma string.' })
  description: string;

  @IsArray({ message: 'O campo "medias" deve ser um array.' })
  @ValidateNested({ each: true })
  @Type(() => IdeasSectionMediaItemDto)
  medias: IdeasSectionMediaItemDto[];
}
