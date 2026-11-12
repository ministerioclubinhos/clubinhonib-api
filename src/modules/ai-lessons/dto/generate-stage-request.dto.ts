import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayNotEmpty,
  ArrayUnique,
  IsArray,
  IsBoolean,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { LESSON_IMAGE_REGENERATION } from '../constants/lesson-image-regeneration.constants';
import {
  LESSON_REVIEW_NOTE_MAX_LENGTH,
  LESSON_VISUAL_QUANTITY,
} from '../constants/lesson-workflow.constants';
import {
  LessonStageType,
  LessonVisualOrientation,
  LessonVisualStyle,
  LessonVisualType,
} from '../enums/lesson.enums';
import { LessonView } from '../enums/lesson-failure-code.enum';

const trimString = ({ value }: { value: unknown }): unknown =>
  typeof value === 'string' ? value.trim() : value;

/**
 * Public body of `POST /lessons/:id/stages/generate`. Provider, model and
 * prompt snapshots are computed by the server and never accepted from here.
 */
export class GenerateStageRequestDto {
  @IsEnum(LessonStageType)
  stage: LessonStageType;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  revisionInstructions?: string;

  @IsOptional()
  @IsEnum(LessonVisualType)
  visualType?: LessonVisualType;

  @IsOptional()
  @IsEnum(LessonVisualOrientation)
  visualOrientation?: LessonVisualOrientation;

  @IsOptional()
  @IsInt()
  @Min(LESSON_VISUAL_QUANTITY.MIN)
  @Max(LESSON_VISUAL_QUANTITY.MAX)
  visualQuantity?: number;

  /** Drawing style of the story visuals; defaults to the illustrated style. */
  @IsOptional()
  @IsEnum(LessonVisualStyle)
  visualStyle?: LessonVisualStyle;
}

/** Stage action bound to the version the user is looking at. */
export class StageActionRequestDto {
  @IsEnum(LessonStageType)
  stage: LessonStageType;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  lockVersion: number;
}

/**
 * Body of `POST /lessons/:id/stages/regenerate-images`: generates again only
 * the chosen images of the version the administrator is looking at.
 */
export class RegenerateStageImagesRequestDto extends StageActionRequestDto {
  @IsArray()
  @ArrayNotEmpty({ message: 'Escolha ao menos uma imagem para regerar.' })
  @ArrayMaxSize(LESSON_IMAGE_REGENERATION.MAX_ASSETS)
  @ArrayUnique()
  @IsString({ each: true })
  @IsNotEmpty({ each: true })
  @MaxLength(LESSON_IMAGE_REGENERATION.ASSET_ID_MAX_LENGTH, { each: true })
  assetIds: string[];

  @IsOptional()
  @Transform(trimString)
  @IsString()
  @MaxLength(LESSON_IMAGE_REGENERATION.INSTRUCTIONS_MAX_LENGTH)
  instructions?: string;
}

export class CompleteStageRequestDto extends StageActionRequestDto {
  /**
   * Explicit confirmation that an outdated item (produced from a previous
   * version of the earlier items) is still valid without regeneration.
   */
  @IsOptional()
  @IsBoolean()
  acknowledgeStale?: boolean;
}

export class ApproveStageRequestDto extends StageActionRequestDto {}

export class RequestStageChangesDto extends StageActionRequestDto {
  @Transform(trimString)
  @IsString()
  @IsNotEmpty({
    message: 'Descreva os ajustes necessários antes de devolver o item.',
  })
  @MaxLength(LESSON_REVIEW_NOTE_MAX_LENGTH)
  note: string;
}

export class ReopenStageRequestDto extends RequestStageChangesDto {}

export class PreviewStagePdfQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  lockVersion?: number;

  @IsOptional()
  @IsUUID()
  versionId?: string;
}

export class LessonViewQueryDto {
  @IsOptional()
  @IsEnum(LessonView)
  view?: LessonView;
}
