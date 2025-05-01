import {
  IsDateString,
  IsString,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { MediaItemDto } from 'src/share/share-dto/media-item-dto';

export class CreateEventDto {
  @IsString({ message: 'title deve ser uma string' })
  title: string;

  @IsDateString({}, { message: 'date deve estar em formato ISO válido (YYYY-MM-DD)' })
  date: string;

  @IsString({ message: 'location deve ser uma string' })
  location: string;

  @IsString({ message: 'description deve ser uma string' })
  description: string;

  @ValidateNested()
  @Type(() => MediaItemDto)
  media: MediaItemDto;
}
