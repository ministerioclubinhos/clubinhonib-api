import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsEnum,
  IsString,
  MaxLength,
  MinLength,
  ValidateNested,
} from 'class-validator';
import {
  IdeaDocumentBlockType,
  IdeaImageKind,
} from '../enums/enhanced-idea.enums';
export {
  IdeaDocumentBlockType,
  IdeaImageKind,
} from '../enums/enhanced-idea.enums';
export class EnhancedIdeaTextDto {
  @IsString() @MinLength(1) @MaxLength(120) title: string;
  @IsString() @MaxLength(6000) description: string;
  @IsArray() @ArrayMaxSize(30) @IsString({ each: true }) changes: string[];
}
export class IdeaEssenceJudgeDto {
  @IsBoolean() preservesEssence: boolean;
  @IsArray() @ArrayMaxSize(30) @IsString({ each: true }) violations: string[];
}
export class IdeaImageClassificationDto {
  @IsBoolean() containsPeople: boolean;
  @IsBoolean() containsText: boolean;
  @IsEnum(IdeaImageKind) kind: IdeaImageKind;
  @IsArray()
  @ArrayMaxSize(30)
  @IsString({ each: true })
  qualityIssues: string[];
}
export class EnhancedIdeaDocumentBlockDto {
  @IsEnum(IdeaDocumentBlockType) type: IdeaDocumentBlockType;
  @IsString() @MaxLength(60000) text: string;
  @IsArray() @ArrayMaxSize(200) @IsString({ each: true }) items: string[];
}
export class EnhancedIdeaDocumentSectionDto {
  @IsString() @MaxLength(255) heading: string;
  @IsArray()
  @ArrayMaxSize(200)
  @ValidateNested({ each: true })
  @Type(() => EnhancedIdeaDocumentBlockDto)
  blocks: EnhancedIdeaDocumentBlockDto[];
}
export class EnhancedIdeaDocumentDto {
  @IsString() @MaxLength(255) title: string;
  @IsArray()
  @ArrayMaxSize(100)
  @ValidateNested({ each: true })
  @Type(() => EnhancedIdeaDocumentSectionDto)
  sections: EnhancedIdeaDocumentSectionDto[];
  @IsBoolean() hasEssentialVisuals: boolean;
  @IsArray()
  @ArrayMaxSize(300)
  @IsString({ each: true })
  preservedFacts: string[];
}
