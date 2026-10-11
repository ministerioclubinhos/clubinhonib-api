import { olderMeditationSequenceKeyMatches } from './older-meditation-sequence.utils';
import { OlderMeditationMechanic } from '../enums/older-meditation.enums';
import {
  OlderMeditationReviewCode as ReviewCode,
  OlderMeditationReviewSeverity as ReviewSeverity,
} from '../enums/older-meditation.enums';
import { ConflictException, Logger } from '@nestjs/common';
import { OLDER_MEDITATION_LIMITS as L } from '../constants/older-meditation-contract.constants';
import {
  LessonImagePurpose,
  type LessonLlmGenerationInput,
  type LessonLlmGenerationResult,
  type LessonLlmProviderContract,
  type LessonImageReference,
} from '../providers/lesson-llm.types';
import type { OlderMeditationReviewIssue } from '../types/older-meditation.types';
import {
  normalizeOlderMeditation,
  olderMeditationContentIssue,
  olderMeditationExpansionContext,
  olderMeditationInstructionWords,
} from './older-meditation-quality.utils';
import { buildMeditationActivityImagePrompt } from './meditation-image.utils';
import { fitOlderMeditationSheet } from './older-meditation-fit.utils';

function object(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function text(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

export async function reviewOlderMeditation(
  llm: LessonLlmProviderContract,
  input: LessonLlmGenerationInput,
  content: Record<string, unknown>,
  images: Array<{ activityNumber: number; image: LessonImageReference }> = [],
): Promise<OlderMeditationReviewIssue[]> {
  const logger = new Logger('OlderMeditationGeneration');
  logger.log(
    `[meditation-older] phase=${images.length ? 'image-review' : 'text-review'} status=start images=${images.length}`,
  );
  const result = await llm.generateStage({
    ...input,
    olderMeditationReview: { content, images },
  });
  if (!Array.isArray(result.content.issues))
    throw new ConflictException(
      'A revisão da meditação não retornou um resultado verificável. Gere novamente.',
    );
  logger.log(
    `[meditation-older] phase=review status=completed responseId=${result.responseId} reportedIssues=${result.content.issues.length}`,
  );
  const blockers = result.content.issues.flatMap((raw) => {
    const issue = object(raw);
    if (
      !Number.isInteger(issue.activityNumber) ||
      Number(issue.activityNumber) < 0 ||
      Number(issue.activityNumber) > L.activities ||
      typeof issue.reason !== 'string' ||
      !issue.reason.trim() ||
      !Object.values(ReviewSeverity).includes(
        issue.severity as ReviewSeverity,
      ) ||
      !Object.values(ReviewCode).includes(issue.code as ReviewCode)
    )
      throw new ConflictException(
        'A revisão da meditação retornou um problema sem identificação ou explicação.',
      );
    const advisory =
      issue.severity === ReviewSeverity.SUGGESTION ||
      issue.code === ReviewCode.STYLE_SUGGESTION;
    const outsidePhase = images.length
      ? issue.code !== ReviewCode.IMAGE_DEFECT
      : issue.code === ReviewCode.IMAGE_DEFECT;
    const activity = object(
      Array.isArray(content.activities)
        ? content.activities[Number(issue.activityNumber) - 1]
        : undefined,
    );
    const computedSequenceKey =
      !images.length &&
      issue.code === ReviewCode.ANSWER_KEY &&
      activity.mechanic === OlderMeditationMechanic.SEQUENCE &&
      olderMeditationSequenceKeyMatches(activity);
    if (advisory || outsidePhase || computedSequenceKey) {
      logger.log(
        `[meditation-older] phase=review status=non-blocking responseId=${result.responseId} activity=${Number(issue.activityNumber)} severity=${String(issue.severity)} code=${String(issue.code)} disposition=${advisory ? 'advisory' : computedSequenceKey ? 'computed-sequence-key' : 'outside-phase'}`,
      );
      return [];
    }
    return [
      {
        activityNumber: Number(issue.activityNumber),
        reason: issue.reason.trim(),
      },
    ];
  });
  logger.log(
    `[meditation-older] phase=review status=classified responseId=${result.responseId} blockers=${blockers.length} nonBlocking=${result.content.issues.length - blockers.length}`,
  );
  return blockers;
}

/** Corrections preserve the complete contract and never coerce a puzzle into a questionnaire. */
export async function createOlderMeditation(
  llm: LessonLlmProviderContract,
  input: LessonLlmGenerationInput,
  generated: LessonLlmGenerationResult,
): Promise<LessonLlmGenerationResult> {
  const logger = new Logger('OlderMeditationGeneration');
  let current = generated;
  let previousLocalFailure: string | undefined;
  for (let attempt = 0; ; attempt++) {
    const content = normalizeOlderMeditation({
      ...current.content,
      title: input.theme,
      biblicalText: input.biblicalReference,
    });
    const metrics = {
      introductionWords: olderMeditationInstructionWords(content.introduction),
      activities: (Array.isArray(content.activities)
        ? content.activities
        : []
      ).map((raw) => {
        const activity = object(raw);
        return {
          number: activity.number,
          mechanic: activity.mechanic,
          subitems: Array.isArray(activity.subitems)
            ? activity.subitems.length
            : 0,
          words: olderMeditationInstructionWords(activity.instruction),
        };
      }),
    };
    logger.log(
      `[meditation-older] phase=local-validation attempt=${attempt + 1}/${L.correctionAttempts + 1} responseId=${current.responseId} metrics=${JSON.stringify(metrics)}`,
    );
    const localIssue = olderMeditationContentIssue(content);
    const issues = localIssue
      ? [localIssue]
      : (await reviewOlderMeditation(llm, input, content)).map(
          (issue) => `Desafio ${issue.activityNumber}: ${issue.reason}`,
        );
    if (!issues.length) {
      const fit = fitOlderMeditationSheet({
        title: text(content.title),
        verse: `${text(content.verseText)}\n${text(content.verseReference)}`,
        biblicalText: text(content.biblicalText),
        introduction: text(content.introduction),
        prayer: text(content.prayer),
        logo: Buffer.alloc(0),
        activities: (Array.isArray(content.activities)
          ? content.activities
          : []
        ).map((raw) => {
          const activity = object(raw);
          return {
            instruction: text(activity.instruction),
            ...(activity.visualRequired ? { image: Buffer.alloc(0) } : {}),
          };
        }),
      });
      const layoutLog = `[meditation-older] phase=layout status=${fit.fits ? 'fits' : 'needs-editing'} responseId=${current.responseId} fontPoints=${fit.fontSize / 2} availableHeight=${fit.activitySpace} requiredHeight=${fit.weights.reduce((sum, height) => sum + height, 0)} blockHeights=${JSON.stringify(fit.weights)} next=save-for-editing`;
      if (fit.fits) logger.log(layoutLog);
      else logger.warn(layoutLog);
      logger.log(
        `[meditation-older] phase=completed attempt=${attempt + 1} responseId=${current.responseId}`,
      );
      return { ...current, content };
    }
    const localFailure = localIssue
      ? JSON.stringify({ localIssue, metrics })
      : undefined;
    const repeatedLocalFailure = Boolean(
      localFailure && localFailure === previousLocalFailure,
    );
    logger.warn(
      `[meditation-older] phase=${localIssue ? 'local-validation' : 'text-review'} status=rejected attempt=${attempt + 1} responseId=${current.responseId} issues=${JSON.stringify(issues)} next=${attempt >= L.correctionAttempts || repeatedLocalFailure ? 'stop' : 'correction'}`,
    );
    if (repeatedLocalFailure) {
      throw new ConflictException(
        `A correção repetiu o mesmo problema sem progresso: ${issues.join(' ')} Novas chamadas automáticas foram interrompidas para evitar consumo desnecessário.`,
      );
    }
    previousLocalFailure = localFailure;
    if (attempt >= L.correctionAttempts)
      throw new ConflictException(
        `A meditação dos maiores ficou incompleta ou inconsistente: ${issues.join(' ')} Gere novamente.`,
      );
    logger.log(
      `[meditation-older] phase=correction status=start attempt=${attempt + 2}/${L.correctionAttempts + 1}`,
    );
    current = await llm.generateStage({
      ...input,
      revisionInstructions: [
        input.revisionInstructions,
        `Corrija especificamente estes problemas: ${issues.join(' ')}`,
        olderMeditationExpansionContext(content),
      ]
        .filter(Boolean)
        .join('\n'),
    });
  }
}

/** Inspect actual artwork before any S3 upload; repair only rejected images, keeping text intact. */
export async function createOlderMeditationImages(
  llm: LessonLlmProviderContract,
  input: LessonLlmGenerationInput,
  content: Record<string, unknown>,
): Promise<Map<string, Buffer>> {
  const assets = Array.isArray(content.printableAssets)
    ? content.printableAssets.map(object)
    : [];
  const activities = Array.isArray(content.activities)
    ? content.activities.map(object)
    : [];
  const buffers = new Map<string, Buffer>();
  if (
    assets.length !== L.activities ||
    new Set(assets.map((asset) => String(asset.id))).size !== L.activities ||
    assets.some((asset) => !['1', '2', '3'].includes(String(asset.id)))
  )
    throw new ConflictException(
      'A meditação dos maiores exige três imagens, uma por questão, com IDs 1, 2 e 3.',
    );
  let issues: OlderMeditationReviewIssue[] = [];
  for (let attempt = 0; ; attempt++) {
    for (const asset of assets) {
      const id = String(asset.id);
      if (
        buffers.has(id) &&
        !issues.some(
          (issue) =>
            issue.activityNumber === 0 || issue.activityNumber === Number(id),
        )
      )
        continue;
      const activity = activities[Number(id) - 1];
      const prompt = buildMeditationActivityImagePrompt(
        '8 a 11 anos',
        String(activity.instruction),
        [
          String(asset.prompt),
          ...issues
            .filter(
              (issue) =>
                issue.activityNumber === 0 ||
                issue.activityNumber === Number(id),
            )
            .map((issue) => `CORRIJA NA ARTE: ${issue.reason}`),
        ].join('\n'),
        String(activity.answer),
        true,
      );
      const buffer = await llm.generateImage(
        prompt,
        undefined,
        undefined,
        undefined,
        LessonImagePurpose.MEDITATION_ACTIVITY,
      );
      const png =
        buffer.length >= 24 &&
        buffer
          .subarray(0, 8)
          .equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
      const jpeg =
        buffer.length >= 3 &&
        buffer[0] === 255 &&
        buffer[1] === 216 &&
        buffer[2] === 255;
      if (!png && !jpeg)
        throw new ConflictException(
          'A arte da meditação não é uma imagem PNG ou JPEG válida.',
        );
      buffers.set(id, buffer);
    }
    issues = await reviewOlderMeditation(
      llm,
      input,
      content,
      [...buffers].map(([id, data]) => ({
        activityNumber: Number(id),
        image: { data, mimeType: data[0] === 137 ? 'image/png' : 'image/jpeg' },
      })),
    );
    if (!issues.length) return buffers;
    if (attempt >= L.correctionAttempts)
      throw new ConflictException(
        `As artes da meditação não correspondem aos desafios: ${issues.map((issue) => issue.reason).join(' ')} A versão anterior foi preservada.`,
      );
  }
}
