import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsDateString,
  IsEnum,
  IsString,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { MediaItemDto } from 'src/shared/share-dto/media-item-dto';
import { WeekDay } from '../entities/day.entity';
import { MEDITATION_DAYS_COUNT } from '../constants';

/** Um dia da meditação enviado na criação. */
export class CreateMeditationDayDto {
  @IsEnum(WeekDay, {
    message:
      'day deve ser um dos valores: Monday, Tuesday, Wednesday, Thursday, Friday',
  })
  day: WeekDay;

  @IsString({ message: 'verse deve ser uma string' })
  verse: string;

  @IsString({ message: 'topic deve ser uma string' })
  topic: string;
}

/** Contrato de `POST /meditations`. */
export class CreateMeditationDto {
  @IsString({ message: 'topic deve ser uma string' })
  topic: string;

  @IsDateString(
    {},
    { message: 'startDate deve estar em formato ISO válido (YYYY-MM-DD)' },
  )
  startDate: string;

  @IsDateString(
    {},
    { message: 'endDate deve estar em formato ISO válido (YYYY-MM-DD)' },
  )
  endDate: string;

  @ValidateNested()
  @Type(() => MediaItemDto)
  media: MediaItemDto;

  @IsArray({ message: 'days deve ser um array' })
  @ArrayMinSize(MEDITATION_DAYS_COUNT, {
    message: `days deve conter exatamente ${MEDITATION_DAYS_COUNT} itens`,
  })
  @ArrayMaxSize(MEDITATION_DAYS_COUNT, {
    message: `days deve conter exatamente ${MEDITATION_DAYS_COUNT} itens`,
  })
  @ValidateNested({ each: true })
  @Type(() => CreateMeditationDayDto)
  days: CreateMeditationDayDto[];
}
