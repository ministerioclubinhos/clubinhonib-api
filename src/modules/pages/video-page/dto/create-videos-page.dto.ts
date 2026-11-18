import {
  IsArray,
  IsBoolean,
  IsString,
  Matches,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { MediaItemDto } from 'src/shared/share-dto/media-item-dto';
import { VIDEO_TITLE_MAX_LENGTH } from '../constants';

export class CreateVideosPageDto {
  @IsString({ message: 'O campo "title" da página deve ser uma string.' })
  @Matches(/\S/, { message: 'O título não pode ficar vazio.' })
  @MaxLength(VIDEO_TITLE_MAX_LENGTH, { message: 'Use até 255 caracteres.' })
  title: string;

  @IsString({ message: 'O campo "description" da página deve ser uma string.' })
  @Matches(/\S/, { message: 'A descrição da página não pode ficar vazia.' })
  description: string;

  @IsBoolean({ message: 'O campo "public" da página deve ser booleano.' })
  public: boolean;

  @IsArray({ message: 'O campo "videos" deve ser um array.' })
  @ValidateNested({ each: true })
  @Type(() => MediaItemDto)
  videos: MediaItemDto[];
}
