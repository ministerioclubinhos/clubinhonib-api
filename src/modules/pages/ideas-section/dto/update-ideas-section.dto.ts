import {
  IsArray,
  IsBoolean,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { IdeasSectionMediaItemDto } from './ideas-section-media-item.dto';
import { IdeaAiDecisionsDto } from '../../ideas-section-ai/dto/idea-ai-decisions.dto';

export class UpdateIdeasSectionDto {
  @IsOptional()
  @ValidateNested()
  @Type(() => IdeaAiDecisionsDto)
  aiDecisions?: IdeaAiDecisionsDto;

  @IsOptional()
  @IsBoolean()
  ignoreAiEnhancement?: boolean;
  @IsString({ message: 'O campo "title" deve ser uma string.' })
  title: string;

  @IsString({ message: 'O campo "description" deve ser uma string.' })
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
