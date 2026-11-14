import { ConflictException } from '@nestjs/common';
import { LESSON_CANONICAL_VERSE_VERSION } from '../constants/lesson-workflow.constants';
import { LessonEntity } from '../entities/lesson.entity';
import { LessonStageType } from '../enums/lesson.enums';
import type {
  LessonCanonicalVerse,
  LessonJsonObject,
} from '../types/lesson-generation.types';
import { lessonString } from '../utils';
import { lessonAsObject, lessonCurrentContent } from './lesson-workflow.utils';

export function lockDerivedVerse(
  lesson: LessonEntity,
  type: LessonStageType,
  generated: LessonJsonObject,
): LessonJsonObject {
  const lessonStage = lesson.stages.find(
    (stage) => stage.type === LessonStageType.LESSON,
  );
  const approvedLesson = lessonStage ? lessonCurrentContent(lessonStage) : null;
  const verse = lessonAsObject(approvedLesson?.memoryVerse);
  const text = lessonString(verse.text).trim();
  const reference = lessonString(verse.reference).trim();
  if (
    !text ||
    !reference ||
    lessonString(verse.version).toUpperCase() !== LESSON_CANONICAL_VERSE_VERSION
  )
    throw new ConflictException(
      'A lição aprovada precisa ter um único versículo principal NVI antes da fixação.',
    );
  const assetKey =
    type === LessonStageType.VERSE_FIXATION ? 'assets' : 'printableAssets';
  const assets = Array.isArray(generated[assetKey])
    ? generated[assetKey].map((item) => lessonAsObject(item))
    : [];
  if (!assets.length && type !== LessonStageType.MEDITATION_OLDER)
    throw new ConflictException(
      'O material derivado precisa conter ao menos uma peça imprimível.',
    );
  if (type === LessonStageType.VERSE_VISUALS) {
    if (assets.length < 2 || assets.length > 10)
      throw new ConflictException(
        'Os visuais do versículo devem conter de uma a nove imagens de trechos e uma imagem final da referência.',
      );
    const canonicalContentAssets = canonicalizeVerseVisualAssets(
      text,
      assets.slice(0, -1),
    );
    assets.splice(0, assets.length - 1, ...canonicalContentAssets);
    assets[assets.length - 1] = {
      ...assets[assets.length - 1],
      displayText: reference,
      purpose: 'Referência bíblica para encerrar a memorização',
    };
  }
  return {
    ...generated,
    verseText: text,
    verseReference: reference,
    verseVersion: LESSON_CANONICAL_VERSE_VERSION,
    [assetKey]: assets,
  };
}

export function canonicalizeVerseVisualAssets(
  verseText: string,
  proposedAssets: LessonJsonObject[],
): LessonJsonObject[] {
  const canonicalWords = verseText.trim().split(/\s+/).filter(Boolean);
  if (!proposedAssets.length || proposedAssets.length > canonicalWords.length)
    throw new ConflictException(
      'A quantidade de visuais precisa permitir ao menos uma palavra do versículo em cada imagem.',
    );

  let cursor = 0;
  return proposedAssets.map((asset, index) => {
    const remainingAssets = proposedAssets.length - index - 1;
    const remainingWords = canonicalWords.length - cursor;
    const proposedWordCount = lessonString(asset.displayText)
      .trim()
      .split(/\s+/)
      .filter(Boolean).length;
    const take =
      remainingAssets === 0
        ? remainingWords
        : Math.min(
            Math.max(proposedWordCount, 1),
            remainingWords - remainingAssets,
          );
    const displayText = canonicalWords.slice(cursor, cursor + take).join(' ');
    cursor += take;
    return { ...asset, displayText };
  });
}

export function canonicalVerseFromLesson(
  lesson: LessonEntity,
): LessonCanonicalVerse | null {
  const lessonStage = lesson.stages.find(
    (stage) => stage.type === LessonStageType.LESSON,
  );
  const approvedLesson = lessonStage ? lessonCurrentContent(lessonStage) : null;
  const verse = lessonAsObject(approvedLesson?.memoryVerse);
  const text = lessonString(verse.text).trim();
  const reference = lessonString(verse.reference).trim();
  return text && reference
    ? {
        text,
        reference,
        version: lessonString(verse.version) || LESSON_CANONICAL_VERSE_VERSION,
      }
    : null;
}
