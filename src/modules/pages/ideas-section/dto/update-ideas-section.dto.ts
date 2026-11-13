import {
  IsArray,
  IsBoolean,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { IdeasSectionMediaItemDto } from './ideas-section-media-item.dto';
import { IdeaAiDecisionsDto } from '../../ideas-section-ai/dto/idea-ai-decisions.dto';
import {
  IDEAS_SECTION_DESCRIPTION_MAX_LENGTH,
  IDEAS_SECTION_TITLE_MAX_LENGTH,
} from '../constants';

export class UpdateIdeasSectionDto {
  @IsOptional()
  @ValidateNested()
  @Type(() => IdeaAiDecisionsDto)
  aiDecisions?: IdeaAiDecisionsDto;

  @IsOptional()
  @IsBoolean()
  ignoreAiEnhancement?: boolean;
  /**
   * Texto final da publicação. Com `aiDecisions`, é a versão escolhida já com
   * as edições da administração: a API não troca mais este texto pelo do
   * snapshot ou da IA.
   */
  @IsString({ message: 'O campo "title" deve ser uma string.' })
  @IsNotEmpty({ message: 'O título da ideia é obrigatório.' })
  @MaxLength(IDEAS_SECTION_TITLE_MAX_LENGTH, {
    message: 'O título da ideia deve ter no máximo 120 caracteres.',
  })
  title: string;

  @IsString({ message: 'O campo "description" deve ser uma string.' })
  @IsNotEmpty({ message: 'A descrição da ideia é obrigatória.' })
  @MaxLength(IDEAS_SECTION_DESCRIPTION_MAX_LENGTH, {
    message: 'A descrição da ideia deve ter no máximo 2000 caracteres.',
  })
  description: string;

  @IsOptional()
  @IsBoolean({ message: 'O campo "public" deve ser booleano.' })
  @Type(() => Boolean)
  public: boolean = false;

  @IsArray({ message: 'O campo "medias" deve ser um array.' })
  @ValidateNested({ each: true })
  @Type(() => IdeasSectionMediaItemDto)
  medias: IdeasSectionMediaItemDto[];
}
