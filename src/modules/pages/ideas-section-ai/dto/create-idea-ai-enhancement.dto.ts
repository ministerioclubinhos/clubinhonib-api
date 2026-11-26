import { Transform } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayUnique,
  IsArray,
  IsEnum,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';
import { IDEA_AI } from '../constants';
import { IdeaAiScope } from '../enums/ideas-section-ai.enums';
import { trimIdeaAiInstructions } from '../utils';

/** Pedido de (re)geração pela administração. Corpo vazio = refazer tudo. */
export class CreateIdeaAiEnhancementDto {
  @IsOptional()
  @IsEnum(IdeaAiScope, { message: 'Escolha o que deve ser refeito.' })
  scope: IdeaAiScope = IdeaAiScope.FULL;

  /** Mídias de origem (snapshot) para o escopo MEDIA. */
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @ArrayUnique()
  @IsUUID('all', { each: true })
  mediaIds?: string[];

  /** Orientação para a IA nesta tentativa ("mais curto", "manter o tom"). */
  @IsOptional()
  @Transform(trimIdeaAiInstructions)
  @IsString()
  @MaxLength(IDEA_AI.maxInstructionsLength, {
    message: 'As orientações devem ter no máximo 500 caracteres.',
  })
  instructions?: string;
}
