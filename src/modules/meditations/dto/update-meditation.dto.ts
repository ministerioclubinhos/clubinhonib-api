import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsDateString,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { MediaItemDto } from 'src/shared/share-dto/media-item-dto';
import { CreateMeditationDayDto } from './create-meditation.dto';
import { MEDITATION_DAYS_COUNT } from '../constants';

/**
 * Contrato de `PATCH /meditations/:id`.
 *
 * `id` é aceito por compatibilidade com o formulário do admin, mas a meditação
 * alterada é sempre a do parâmetro de rota.
 */
export class UpdateMeditationDto {
  @IsOptional()
  @IsString({ message: 'id deve ser uma string' })
  id?: string;

  @IsOptional()
  @IsString({ message: 'topic deve ser uma string' })
  topic?: string;

  @IsOptional()
  @IsDateString(
    {},
    { message: 'startDate deve estar em formato ISO válido (YYYY-MM-DD)' },
  )
  startDate?: string;

  @IsOptional()
  @IsDateString(
    {},
    { message: 'endDate deve estar em formato ISO válido (YYYY-MM-DD)' },
  )
  endDate?: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => MediaItemDto)
  media?: MediaItemDto;

  /**
   * Quando enviados, os dias substituem integralmente os atuais, então a
   * semana precisa vir completa.
   */
  @IsOptional()
  @IsArray({ message: 'days deve ser um array' })
  @ArrayMinSize(MEDITATION_DAYS_COUNT, {
    message: `days deve conter exatamente ${MEDITATION_DAYS_COUNT} itens`,
  })
  @ArrayMaxSize(MEDITATION_DAYS_COUNT, {
    message: `days deve conter exatamente ${MEDITATION_DAYS_COUNT} itens`,
  })
  @ValidateNested({ each: true })
  @Type(() => CreateMeditationDayDto)
  days?: CreateMeditationDayDto[];
}
