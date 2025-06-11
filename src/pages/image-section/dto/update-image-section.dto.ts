import {
  IsArray,
  IsBoolean,
  IsString,
  ValidateNested,
  IsOptional,
} from 'class-validator';
import { Type } from 'class-transformer';
import { MediaItemDto } from 'src/share/share-dto/media-item-dto';

export class UpdateImageSectionDto {

  @IsString({ message: 'O campo "caption" deve ser uma string.' })
  caption: string;

  @IsString({ message: 'O campo "description" deve ser uma string.' })
  description: string;

  @IsOptional()
  @IsBoolean({ message: 'O campo "public" deve ser booleano.' })
  @Type(() => Boolean)
  public: boolean = false;

  @IsArray({ message: 'O campo "mediaItems" deve ser um array.' })
  @ValidateNested({ each: true })
  @Type(() => MediaItemDto)
  mediaItems: MediaItemDto[];
}
