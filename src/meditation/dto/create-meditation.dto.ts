import {
  IsArray,
  IsDateString,
  IsEnum,
  IsString,
  ValidateNested,
  ArrayMinSize,
  ArrayMaxSize,
  IsOptional,
} from 'class-validator';
import { Type } from 'class-transformer';
import { WeekDay } from '../entities/day.entity';
import { MediaItemDto } from 'src/share/share-dto/media-item-dto';

class DayDto {

  @IsEnum(WeekDay, {
    message: 'day deve ser um dos valores: Monday, Tuesday, Wednesday, Thursday, Friday',
  })
  day: WeekDay;

  @IsString({ message: 'verse deve ser uma string' })
  verse: string;

  @IsString({ message: 'topic deve ser uma string' })
  topic: string;
}


export class CreateMeditationDto {

  @IsString({ message: 'topic deve ser uma string' })
  topic: string;

  @IsDateString({}, { message: 'startDate deve estar em formato ISO válido (YYYY-MM-DD)' })
  startDate: string;

  @IsDateString({}, { message: 'endDate deve estar em formato ISO válido (YYYY-MM-DD)' })
  endDate: string;

  @ValidateNested()
  @Type(() => MediaItemDto)
  media: MediaItemDto;

  @IsArray({ message: 'days deve ser um array' })
  @ArrayMinSize(5, { message: 'days deve conter exatamente 5 itens' })
  @ArrayMaxSize(5, { message: 'days deve conter exatamente 5 itens' })
  @ValidateNested({ each: true })
  @Type(() => DayDto)
  days: DayDto[];
}
