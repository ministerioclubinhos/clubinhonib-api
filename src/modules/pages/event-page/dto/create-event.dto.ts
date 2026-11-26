import {
  IsDateString,
  IsEnum,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { MediaItemDto } from 'src/shared/share-dto/media-item-dto';
import { EventAudience, EventType } from '../entities/event.entity';

export class CreateEventDto {
  @IsString({ message: 'title deve ser uma string' })
  title: string;

  @IsDateString({}, { message: 'date deve estar em formato ISO válido' })
  date: string;

  @IsString({ message: 'location deve ser uma string' })
  location: string;

  @IsString({ message: 'description deve ser uma string' })
  description: string;

  @IsEnum(EventAudience)
  @IsOptional()
  audience?: EventAudience;

  @IsEnum(EventType)
  @IsOptional()
  eventType?: EventType;

  @IsOptional()
  @ValidateNested()
  @Type(() => MediaItemDto)
  media?: MediaItemDto;
}
