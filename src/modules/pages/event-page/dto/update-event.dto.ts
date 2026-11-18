import {
  IsBoolean,
  IsDateString,
  IsEnum,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { MediaItemDto } from 'src/shared/share-dto/media-item-dto';
import { EventAudience, EventType } from '../entities/event.entity';

export class UpdateEventDto {
  @IsOptional()
  @IsString({ message: 'id deve ser uma string' })
  id?: string;

  @IsOptional()
  @IsString({ message: 'title deve ser uma string' })
  title?: string;

  @IsOptional()
  @IsString({ message: 'description deve ser uma string' })
  description?: string;

  @IsOptional()
  @IsDateString({}, { message: 'date deve estar em formato ISO válido' })
  date?: string;

  @IsOptional()
  @IsString({ message: 'location deve ser uma string' })
  location?: string;

  @IsOptional()
  @IsEnum(EventAudience)
  audience?: EventAudience;

  @IsOptional()
  @IsEnum(EventType)
  eventType?: EventType;

  @IsOptional()
  @ValidateNested()
  @Type(() => MediaItemDto)
  media?: MediaItemDto;

  @IsOptional()
  @IsBoolean({
    message: 'isLocalFile deve ser um valor booleano (true ou false)',
  })
  isLocalFile?: boolean;
}
