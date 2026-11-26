import {
  CUTOUT_COVERAGE_COVERED,
  CUTOUT_COVERAGE_NOT_APPLICABLE,
  CUTOUT_DEFAULT_ITEM_SIZE,
} from 'src/modules/ai-lessons/constants/story-visual-quality.constants';
import { CutoutCategory } from 'src/modules/ai-lessons/enums/lesson.enums';
import { AI_FAKE_TEXT, AI_FAKE_VISUALS } from './constants';
import { AiFakeStorySource, JsonRecord } from './types';

/**
 * Os visuais têm regras que o JSON Schema não expressa (numeração e divisão
 * literal da história, categorias obrigatórias do kit). Um mínimo válido pelo
 * schema seria recusado, o que um LLM real não faria.
 */
export function splitStory(story: string, parts: number): string[] {
  const words = story.trim().split(/\s+/).filter(Boolean);
  const total = Math.max(1, Math.min(parts, words.length));
  return Array.from({ length: total }, (_, index) =>
    words
      .slice(
        Math.round((index * words.length) / total),
        Math.round(((index + 1) * words.length) / total),
      )
      .join(' '),
  );
}

const sequentialId = (prefix: string, index: number): string =>
  `${prefix}-${String(index + 1).padStart(2, '0')}`;

export function fakeStoryVisuals(source: AiFakeStorySource): JsonRecord {
  return {
    assets: splitStory(source.story, source.quantity).map((excerpt, index) => ({
      id: sequentialId(AI_FAKE_VISUALS.storyIdPrefix, index),
      sourceExcerpt: excerpt,
      purpose: AI_FAKE_TEXT,
      prompt: excerpt,
      altText: excerpt,
    })),
  };
}

export function fakeCutoutKit(source: AiFakeStorySource): JsonRecord {
  const categories = Object.values(CutoutCategory);
  const required: CutoutCategory[] = [
    CutoutCategory.CHARACTERS,
    CutoutCategory.SCENERY,
    CutoutCategory.SKY_AND_NATURE,
    CutoutCategory.OBJECTS,
  ];
  const sheets = Math.max(required.length, source.quantity);
  const assets = Array.from({ length: sheets }, (_, index) => {
    const category = required[index % required.length];
    return {
      id: sequentialId(AI_FAKE_VISUALS.cutoutIdPrefix, index),
      category,
      title: `${AI_FAKE_TEXT} ${index + 1}`,
      items: [
        {
          label: `${AI_FAKE_VISUALS.itemLabel} ${index + 1}`,
          description: AI_FAKE_TEXT,
          category,
          storyEvidence: '',
          variantOf: null,
          // Além do básico, cada prancha acrescenta um elemento extra.
          extra: true,
          size: CUTOUT_DEFAULT_ITEM_SIZE,
        },
      ],
      layoutPlan: AI_FAKE_TEXT,
      prompt: AI_FAKE_TEXT,
      altText: AI_FAKE_TEXT,
    };
  });
  return {
    assets,
    coverageChecklist: categories.map((category) => ({
      category,
      status: required.includes(category)
        ? CUTOUT_COVERAGE_COVERED
        : CUTOUT_COVERAGE_NOT_APPLICABLE,
      justification: required.includes(category) ? '' : AI_FAKE_TEXT,
    })),
  };
}
