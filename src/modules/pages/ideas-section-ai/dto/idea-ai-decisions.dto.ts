import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayUnique,
  IsArray,
  IsIn,
  IsUUID,
  ValidateNested,
} from 'class-validator';
import { IdeaAiDecision } from '../enums/ideas-section-ai.enums';
export class IdeaAiMediaDecisionDto {
  @IsUUID() sourceMediaId: string;
  @IsIn([IdeaAiDecision.ORIGINAL, IdeaAiDecision.ENHANCED])
  decision: IdeaAiDecision;
}
export class IdeaAiDecisionsDto {
  @IsUUID() enhancementId: string;
  @IsIn([IdeaAiDecision.ORIGINAL, IdeaAiDecision.ENHANCED])
  title: IdeaAiDecision;
  @IsIn([IdeaAiDecision.ORIGINAL, IdeaAiDecision.ENHANCED])
  description: IdeaAiDecision;
  @IsArray()
  @ArrayMaxSize(20)
  @ArrayUnique((item: IdeaAiMediaDecisionDto) => item.sourceMediaId)
  @ValidateNested({ each: true })
  @Type(() => IdeaAiMediaDecisionDto)
  medias: IdeaAiMediaDecisionDto[];
}
