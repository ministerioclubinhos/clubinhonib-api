import {
  ArrayMinSize,
  ArrayMaxSize,
  MaxLength,
  MinLength,
} from 'class-validator';
import { Transform } from 'class-transformer';
import { CLUBINHO_MAX_PHOTOS } from '../constants';
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
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @MinLength(1)
  @MaxLength(255)
  caption: string;

  @IsString({ message: 'O campo "description" deve ser uma string.' })
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @MinLength(1)
  description: string;

  @IsArray({ message: 'O campo "mediaItems" deve ser um array.' })
  @ArrayMinSize(1)
  @ArrayMaxSize(CLUBINHO_MAX_PHOTOS)
  @ValidateNested({ each: true })
  @Type(() => MediaItemDto)
  mediaItems: MediaItemDto[];
}
