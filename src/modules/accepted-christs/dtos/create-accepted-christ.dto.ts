import {
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';
import { Transform } from 'class-transformer';

import { ACCEPTED_CHRIST_NOTES_MAX_LENGTH } from '../constants';
import { DecisionType } from '../enums/decision-type.enum';

export class CreateAcceptedChristDto {
  /** Obrigatória: sem o tipo não dá para aplicar as regras de decisão. */
  @IsEnum(DecisionType)
  decision: DecisionType;

  @IsUUID()
  @IsNotEmpty()
  childId: string;

  /**
   * Observação de quem registrou. Vazio equivale a não informado, e o limite é
   * o da coluna: sem ele, um texto maior derrubava a gravação com erro interno
   * em vez de recusar a entrada.
   */
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' && value.trim() === '' ? null : value,
  )
  @IsOptional()
  @IsString()
  @MaxLength(ACCEPTED_CHRIST_NOTES_MAX_LENGTH)
  notes?: string | null;
}
