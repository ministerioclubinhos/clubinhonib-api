import { LESSON_EDITORIAL_FIELD_ORDER } from '../constants/lesson-editorial.constants';
import { LessonCategory, LessonStageType } from '../enums/lesson.enums';
import type { LessonJsonObject } from '../types/lesson-generation.types';
import {
  lessonHeaderLines,
  lessonStoryHeading,
  lessonString,
  normalizeLessonVerseReference,
  unquoteLessonVerse,
} from '../utils';

/** Builds the editable Tiptap document of a generated structured content. */
export function lessonContentToTiptap(
  value: LessonJsonObject,
  weekNumber?: number | null,
  stageType?: LessonStageType,
  category?: LessonCategory | null,
): LessonJsonObject {
  const nodes: LessonJsonObject[] = [];
  const labels: Record<string, string> = {
    title: 'TÍTULO',
    biblicalReference: 'TEXTO BÍBLICO',
    purpose: 'PROPÓSITO',
    songs: 'MÚSICAS',
    memoryVerse: 'VERSÍCULO PARA MEMORIZAR',
    text: 'TEXTO DO VERSÍCULO',
    reference: 'REFERÊNCIA',
    version: 'VERSÃO',
    principleExplanation: 'EXPLICAÇÃO DO PRINCÍPIO',
    story: 'LIÇÃO BÍBLICA',
    applicationAndAppeal: 'APLICAÇÃO E APELO',
    counseling: 'ACONSELHAMENTO / CANTINHO DO ACONSELHAMENTO',
    reviewQuestions: 'PERGUNTAS DA LIÇÃO',
    question: 'PERGUNTA',
    answer: 'RESPOSTA',
    closingPrayer: 'FALANDO COM DEUS',
    name: 'NOME',
    objective: 'OBJETIVO',
    funMechanics: 'MECÂNICAS DIVERTIDAS',
    materials: 'MATERIAIS',
    preparation: 'PREPARAÇÃO',
    steps: 'PASSO A PASSO',
    rulesAndSafety: 'REGRAS E SEGURANÇA',
    biblicalPrinciple: 'PRINCÍPIO BÍBLICO',
    verseText: 'TEXTO DO VERSÍCULO',
    verseReference: 'REFERÊNCIA DO VERSÍCULO',
    verseVersion: 'VERSÃO BÍBLICA',
    splitRationale: 'CRITÉRIO DA DIVISÃO',
    durationMinutes: 'DURAÇÃO EM MINUTOS',
    ageAdaptations: 'ADAPTAÇÕES POR IDADE',
    ages5To7: 'CRIANÇAS DE 5 A 7 ANOS',
    ages8To11: 'CRIANÇAS DE 8 A 11 ANOS',
    evaluation: 'COMO AVALIAR',
    ageGroup: 'FAIXA ETÁRIA',
    biblicalText: 'TEXTO BÍBLICO',
    introduction: 'ENTENDENDO A LIÇÃO',
    activities: 'ATIVIDADES',
    instruction: 'INSTRUÇÃO',
    prayer: 'FALANDO COM DEUS',
    printLayout: 'FORMATO DE IMPRESSÃO',
  };
  const label = (key: string): string =>
    labels[key] ??
    key
      .replace(/([a-z])([A-Z])/g, '$1 $2')
      .replace(/_/g, ' ')
      .toLocaleUpperCase('pt-BR');
  const paragraph = (text: string): LessonJsonObject => ({
    type: 'paragraph',
    content: [{ type: 'text', text }],
  });
  const blockquote = (text: string): LessonJsonObject => ({
    type: 'blockquote',
    content: [paragraph(text)],
  });
  const append = (key: string, raw: unknown, depth = 2): void => {
    if (key.startsWith('_')) return;
    if (key === 'closingPrayer' && !lessonString(raw).trim()) return;
    if (
      [
        'assets',
        'printableAssets',
        'visualScenes',
        'visualConfig',
        'verseText',
        'verseReference',
        'verseVersion',
      ].includes(key)
    )
      return;
    if (key === 'title') {
      const titleText = lessonString(raw).trim();
      if (titleText) {
        const lines =
          'story' in value || weekNumber !== undefined
            ? lessonHeaderLines(titleText, weekNumber, category)
            : [titleText];
        lines.forEach((text) =>
          nodes.push({
            type: 'heading',
            attrs: { level: 1 },
            content: [{ type: 'text', text }],
          }),
        );
      }
      return;
    }
    nodes.push({
      type: 'heading',
      attrs: { level: Math.min(depth, 3) },
      content: [{ type: 'text', text: label(key) }],
    });
    if (key === 'memoryVerse' && raw && typeof raw === 'object') {
      const verseObj = raw as LessonJsonObject;
      const text = lessonString(verseObj.text).trim();
      const reference = normalizeLessonVerseReference(verseObj.reference);
      const version = lessonString(verseObj.version).trim();
      if (text) {
        nodes.push(paragraph(`“${unquoteLessonVerse(text)}”`));
      }
      if (reference || version) {
        nodes.push(paragraph([reference, version].filter(Boolean).join(' — ')));
      }
      return;
    }
    if (
      typeof raw === 'string' ||
      typeof raw === 'number' ||
      typeof raw === 'boolean'
    ) {
      const textStr = String(raw).trim();
      const normalizedText = textStr.replace(
        /(?:\s+)?(scene-\d{1,2}:[^\n.?]+(?:\.|\?|(?=\s+scene-|\n|$)))/gi,
        '\n\n$1\n\n',
      );
      const lines = normalizedText
        .split(/\r?\n/)
        .map((l) => l.trim())
        .filter(Boolean);

      if (lines.length === 0) {
        nodes.push(paragraph(textStr));
        return;
      }

      for (const line of lines) {
        const storyHeading =
          key === 'story' ? lessonStoryHeading(line) : undefined;
        if (storyHeading) {
          nodes.push({
            type: 'heading',
            attrs: { level: 3, textAlign: 'left' },
            content: [{ type: 'text', text: storyHeading }],
          });
        } else if (/^(scene-\d+|cena-\d+|\[scene|\[cena)/i.test(line)) {
          const cleanLine = line
            .replace(/^(?:\[?\s*(?:scene|cena)[-\s_]*\d+\s*\]?:?|-?)\s*/i, '')
            .trim();
          nodes.push(blockquote(cleanLine || line));
        } else {
          nodes.push(paragraph(line));
        }
      }
      return;
    }
    if (Array.isArray(raw)) {
      const stringItems = raw
        .filter((item): item is string => typeof item === 'string')
        .map((s) => s.trim())
        .filter(Boolean);

      if (stringItems.length > 0 && stringItems.length === raw.length) {
        nodes.push({
          type: 'bulletList',
          content: stringItems.map((str) => ({
            type: 'listItem',
            content: [paragraph(str)],
          })),
        });
        return;
      }

      raw.forEach((item, index) => {
        if (typeof item === 'string')
          nodes.push({
            type: 'bulletList',
            content: [{ type: 'listItem', content: [paragraph(item)] }],
          });
        else if (item && typeof item === 'object') {
          const entry = item as LessonJsonObject;
          if (stageType === LessonStageType.MEDITATION_OLDER) {
            nodes.push({
              type: 'heading',
              attrs: { level: 3 },
              content: [{ type: 'text', text: `ATIVIDADE ${index + 1}` }],
            });
            append('instruction', entry.instruction, 3);
            return;
          }
          const question = lessonString(entry.question).trim();
          const answer = lessonString(entry.answer).trim();
          if (
            question ||
            (answer &&
              ![
                LessonStageType.MEDITATION_YOUNGER,
                LessonStageType.MEDITATION_OLDER,
              ].includes(stageType as LessonStageType))
          ) {
            nodes.push(paragraph(`${index + 1}. ${question}`));
            if (answer) nodes.push(paragraph(`Resposta: ${answer}`));
          } else {
            nodes.push({
              type: 'heading',
              attrs: { level: 3 },
              content: [{ type: 'text', text: `ATIVIDADE ${index + 1}` }],
            });
            Object.entries(entry)
              .filter(([childKey]) => childKey !== 'number')
              .forEach(([childKey, child]) => append(childKey, child, 3));
          }
        }
      });
      return;
    }
    if (raw && typeof raw === 'object')
      Object.entries(raw as LessonJsonObject).forEach(([childKey, child]) =>
        append(childKey, child, 3),
      );
  };
  const verseText = lessonString(value.verseText).trim();
  const verseReference = lessonString(value.verseReference).trim();
  const verseVersion = lessonString(value.verseVersion).trim();
  let verseBlockAdded = false;
  const entries =
    'story' in value
      ? [
          ...LESSON_EDITORIAL_FIELD_ORDER.filter((key) => key in value).map(
            (key): [string, unknown] => [key, value[key]],
          ),
          ...Object.entries(value).filter(
            ([key]) =>
              !LESSON_EDITORIAL_FIELD_ORDER.some((field) => field === key),
          ),
        ]
      : Object.entries(value);
  entries.forEach(([key, raw]) => {
    if (
      !verseBlockAdded &&
      ['verseText', 'verseReference', 'verseVersion'].includes(key) &&
      (verseText || verseReference || verseVersion)
    ) {
      verseBlockAdded = true;
      nodes.push({
        type: 'heading',
        attrs: { level: 2 },
        content: [{ type: 'text', text: 'VERSÍCULO PARA MEMORIZAR' }],
      });
      if (verseText)
        nodes.push(paragraph(`“${unquoteLessonVerse(verseText)}”`));
      if (verseReference || verseVersion)
        nodes.push(
          paragraph([verseReference, verseVersion].filter(Boolean).join(' — ')),
        );
    }
    append(key, raw);
  });
  return { type: 'doc', content: nodes };
}
