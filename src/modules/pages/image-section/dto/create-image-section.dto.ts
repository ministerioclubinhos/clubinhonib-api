import { IsArray, IsString, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { MediaItemDto } from 'src/shared/share-dto/media-item-dto';

/**
 * Fotos enviadas por um clubinho.
 *
 * `public` não entra aqui: a publicação nasce fora do ar e quem decide levá-la
 * ao feed é a administração, na revisão.
 */
export class CreateImageSectionDto {
  @IsString({ message: 'O campo "caption" deve ser uma string.' })
  caption: string;

  @IsString({ message: 'O campo "description" deve ser uma string.' })
  description: string;

  @IsArray({ message: 'O campo "mediaItems" deve ser um array.' })
  @ValidateNested({ each: true })
  @Type(() => MediaItemDto)
  mediaItems: MediaItemDto[];
}
