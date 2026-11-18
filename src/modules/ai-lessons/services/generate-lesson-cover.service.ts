import { Injectable, Logger } from '@nestjs/common';
import { AwsS3Service } from 'src/shared/providers/aws/aws-s3.service';
import { LESSON_COVER } from '../constants/lesson-cover.constants';
import {
  LessonImagePurpose,
  LessonLlmGenerationInput,
  LessonLlmProviderContract,
} from '../providers/lesson-llm.types';
import type { LessonCoverBrief } from '../types/lesson-cover.types';
import type { LessonJsonObject } from '../types/lesson-generation.types';
import {
  buildCoverBriefRequest,
  buildLessonCoverPrompt,
  cropToCoverProportion,
  fallbackCoverBrief,
  lessonCoverFileName,
  lessonCoverLlmContext,
  parseCoverBrief,
  type LessonCoverSource,
} from '../utils/lesson-cover.utils';
import { LessonGenerationAbortedError } from '../utils/lesson-ai-failure.utils';
import { throwIfGenerationAborted } from '../utils/lesson-studio-errors.utils';
import { assertLessonUploadImage } from '../utils/lesson-upload-image.utils';

/**
 * Draws and stores the presentation image of a lesson in two steps: the text
 * model writes a short brief (simplified title, protagonist, scene), then the
 * image model draws it. The brief never fails the cover: without it the image
 * is drawn from the lesson alone.
 */
@Injectable()
export class GenerateLessonCoverService {
  private readonly logger = new Logger(GenerateLessonCoverService.name);

  constructor(private readonly s3: AwsS3Service) {}

  /** Returns the URL of the stored image; the caller owns it (links it or discards it). */
  async generate(params: {
    lessonId: string;
    lesson: LessonCoverSource;
    content: LessonJsonObject;
    llmProvider: LessonLlmProviderContract;
    /** Context for the text call; built from the lesson when absent. */
    generationInput?: LessonLlmGenerationInput;
    signal?: AbortSignal;
  }): Promise<string> {
    throwIfGenerationAborted(params.signal);
    const brief = await this.writeBrief(params);
    throwIfGenerationAborted(params.signal);
    const raw = await params.llmProvider.generateImage(
      buildLessonCoverPrompt(brief, params.lesson, params.content),
      String(LESSON_COVER.ORIENTATION),
      undefined,
      undefined,
      LessonImagePurpose.COVER,
    );
    const buffer = await cropToCoverProportion(raw);
    const image = assertLessonUploadImage(buffer);
    throwIfGenerationAborted(params.signal);
    return this.s3.upload({
      buffer,
      originalname: lessonCoverFileName(params.lessonId, image.extension),
      mimetype: image.mimeType,
      size: buffer.length,
    } as Express.Multer.File);
  }

  private async writeBrief(params: {
    lessonId: string;
    lesson: LessonCoverSource;
    content: LessonJsonObject;
    llmProvider: LessonLlmProviderContract;
    generationInput?: LessonLlmGenerationInput;
  }): Promise<LessonCoverBrief> {
    const { llmProvider, lesson, content } = params;
    if (!llmProvider.generateStructured) return fallbackCoverBrief(lesson);
    const request = buildCoverBriefRequest(lesson, content);
    const context = params.generationInput ?? lessonCoverLlmContext(lesson);
    for (
      let attempt = 1;
      attempt <= LESSON_COVER.BRIEF_ATTEMPTS;
      attempt += 1
    ) {
      try {
        const answer = await llmProvider.generateStructured(request, context);
        const parsed = parseCoverBrief(answer.content, lesson);
        if ('brief' in parsed) return parsed.brief;
        this.logger.warn(
          `Briefing da capa da lição ${params.lessonId} inválido (tentativa ${attempt}/${LESSON_COVER.BRIEF_ATTEMPTS}): ${parsed.problem}.`,
        );
      } catch (error: unknown) {
        if (error instanceof LessonGenerationAbortedError) throw error;
        this.logger.warn(
          `Briefing da capa da lição ${params.lessonId} falhou (tentativa ${attempt}/${LESSON_COVER.BRIEF_ATTEMPTS}): ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    }
    this.logger.warn(
      `Capa da lição ${params.lessonId} será desenhada sem briefing, só com o tema.`,
    );
    return fallbackCoverBrief(lesson);
  }
}
