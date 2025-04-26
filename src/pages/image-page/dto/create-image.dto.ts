import {
  IsArray,
  IsBoolean,
  IsString,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { MediaItemDto } from 'src/share/share-dto/media-item-dto';

class SectionDto {

  @IsString({ message: 'O campo "caption" da seção deve ser uma string.' })
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

export class CreateImagePageDto {

  @IsString({ message: 'O campo "title" da galeria deve ser uma string.' })
  title: string;

  @IsString({ message: 'O campo "description" da galeria deve ser uma string.' })
  description: string;

  @IsBoolean({ message: 'O campo "public" da galeria deve ser booleano.' })
  public: boolean;

  @IsArray({ message: 'O campo "sections" deve ser um array.' })
  @ValidateNested({ each: true })
  @Type(() => SectionDto)
  sections: SectionDto[];
}
