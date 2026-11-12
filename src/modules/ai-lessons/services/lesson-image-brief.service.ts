import { Injectable, Logger } from '@nestjs/common';
import { LESSON_IMAGE_BRIEF } from '../constants/lesson-image-brief.constants';
import { LessonImageBriefOrigin } from '../enums/lesson-image-brief.enum';
import { LessonStageType } from '../enums/lesson.enums';
import type {
  LessonLlmGenerationInput,
  LessonLlmProviderContract,
} from '../providers/lesson-llm.types';
import type { LessonJsonObject } from '../types/lesson-generation.types';
import { lessonString } from '../utils';
import {
  buildImageBriefRequest,
  imageBriefApplies,
  parseImageBrief,
  plannedImagesOf,
  readImageBrief,
  stageContentForBrief,
  withImageBrief,
} from '../utils/lesson-image-brief.utils';
import { lessonAsObject } from '../utils/lesson-workflow.utils';

interface EnsureImageBriefInput {
  type: LessonStageType;
  content: LessonJsonObject;
  /** Content of the lesson item (story and verse); null when unavailable. */
  canonicalLesson: LessonJsonObject | null;
  adminPrompt: string;
  generationInput: LessonLlmGenerationInput;
  origin: LessonImageBriefOrigin;
}

/**
 * Writes the master image prompt of an item before any image is generated,
 * and keeps the one a version already has. It never fails a generation: when
 * the brief cannot be written, the images are produced from the stage rules
 * alone, as before the brief existed.
 */
@Injectable()
export class LessonImageBriefService {
  private readonly logger = new Logger(LessonImageBriefService.name);

  /** Returns the content with a brief; the same object when nothing changed. */
  async ensure(
    llm: LessonLlmProviderContract,
    input: EnsureImageBriefInput,
  ): Promise<LessonJsonObject> {
    const { type, content } = input;
    if (!imageBriefApplies(type) || !llm.generateStructured) return content;
    const planned = plannedImagesOf(type, content);
    if (planned.length === 0) return content;
    if (readImageBrief(type, content)) return content;

    const request = buildImageBriefRequest({
      theme: input.generationInput.theme,
      biblicalReference: input.generationInput.biblicalReference,
      category: String(input.generationInput.category ?? ''),
      stage: type,
      adminGuidance: input.adminPrompt,
      story: lessonString(input.canonicalLesson?.story).trim(),
      memoryVerse: input.canonicalLesson?.memoryVerse
        ? lessonAsObject(input.canonicalLesson.memoryVerse)
        : null,
      visualConfig: content.visualConfig
        ? lessonAsObject(content.visualConfig)
        : null,
      stageContent: stageContentForBrief(type, content),
      plannedImages: planned,
    });
    for (
      let attempt = 1;
      attempt <= LESSON_IMAGE_BRIEF.ATTEMPTS;
      attempt += 1
    ) {
      try {
        const answer = await llm.generateStructured(
          request,
          input.generationInput,
        );
        const parsed = parseImageBrief(answer.content, planned, input.origin);
        if ('brief' in parsed) return withImageBrief(content, parsed.brief);
        this.logger.warn(
          `Prompt mestre de imagens de ${type} inválido (tentativa ${attempt}/${LESSON_IMAGE_BRIEF.ATTEMPTS}): ${parsed.problem}.`,
        );
      } catch (error: unknown) {
        this.logger.warn(
          `Prompt mestre de imagens de ${type} falhou (tentativa ${attempt}/${LESSON_IMAGE_BRIEF.ATTEMPTS}): ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    }
    this.logger.warn(
      `Imagens de ${type} serão geradas sem prompt mestre: usando apenas as regras do item.`,
    );
    return content;
  }
}
