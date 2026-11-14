import { LessonStageType } from '../enums/lesson.enums';
import type { CanonicalSectionField } from '../types/lesson-canonical-content.types';
import { CanonicalSectionKind } from '../enums/lesson-canonical-content.enums';

/** Bible version required for the lesson's main verse. */
export const LESSON_REQUIRED_BIBLE_VERSION = 'NVI';

/** Separator between table cells when a table is flattened to canonical text. */
export const CANONICAL_TABLE_CELL_SEPARATOR = ' | ';

/** Upper bound accepted for an edited game duration. */
export const GAME_MAX_DURATION_MINUTES = 600;

/** Legacy sub-headings once rendered inside VERSÍCULO PARA MEMORIZAR. */
export const LESSON_VERSE_SUBHEADINGS = {
  text: ['TEXTO DO VERSÍCULO'],
  reference: ['REFERÊNCIA', 'REFERÊNCIA DO VERSÍCULO'],
  version: ['VERSÃO', 'VERSÃO BÍBLICA'],
} as const;

/** Editorial sections of item 1, in the order rendered by the editor. */
export const LESSON_CANONICAL_SECTIONS: readonly CanonicalSectionField[] = [
  {
    key: 'biblicalReference',
    headings: ['TEXTO BÍBLICO'],
    kind: CanonicalSectionKind.TEXT,
  },
  { key: 'purpose', headings: ['PROPÓSITO'], kind: CanonicalSectionKind.TEXT },
  { key: 'songs', headings: ['MÚSICAS'], kind: CanonicalSectionKind.LIST },
  {
    key: 'memoryVerse',
    headings: ['VERSÍCULO PARA MEMORIZAR'],
    kind: CanonicalSectionKind.VERSE,
  },
  {
    key: 'principleExplanation',
    headings: ['EXPLICAÇÃO DO PRINCÍPIO'],
    kind: CanonicalSectionKind.TEXT,
  },
  {
    key: 'story',
    headings: [
      'LIÇÃO BÍBLICA',
      'HISTÓRIA BÍBLICA',
      'HISTÓRIA E CONEXÃO BÍBLICA',
    ],
    kind: CanonicalSectionKind.TEXT,
  },
  {
    key: 'applicationAndAppeal',
    headings: ['APLICAÇÃO E APELO'],
    kind: CanonicalSectionKind.TEXT,
  },
  {
    key: 'counseling',
    headings: [
      'ACONSELHAMENTO / CANTINHO DO ACONSELHAMENTO',
      'CANTINHO DO ACONSELHAMENTO',
      'ACONSELHAMENTO',
    ],
    kind: CanonicalSectionKind.TEXT,
  },
  {
    key: 'reviewQuestions',
    headings: ['PERGUNTAS DA LIÇÃO'],
    kind: CanonicalSectionKind.QUESTIONS,
  },
  {
    key: 'closingPrayer',
    headings: ['FALANDO COM DEUS'],
    kind: CanonicalSectionKind.TEXT,
  },
];

/** Editorial sections of the game and verse-fixation items (3 and 5). */
export const GAME_CANONICAL_SECTIONS: readonly CanonicalSectionField[] = [
  { key: 'name', headings: ['NOME'], kind: CanonicalSectionKind.TEXT },
  { key: 'objective', headings: ['OBJETIVO'], kind: CanonicalSectionKind.TEXT },
  {
    key: 'durationMinutes',
    headings: ['DURAÇÃO EM MINUTOS', 'DURAÇÃO'],
    kind: CanonicalSectionKind.NUMBER,
  },
  {
    key: 'ageGroup',
    headings: ['FAIXA ETÁRIA'],
    kind: CanonicalSectionKind.TEXT,
  },
  {
    key: 'funMechanics',
    headings: ['MECÂNICAS DIVERTIDAS', 'FUN MECHANICS'],
    kind: CanonicalSectionKind.TEXT_OR_LIST,
  },
  {
    key: 'materials',
    headings: ['MATERIAIS'],
    kind: CanonicalSectionKind.LIST,
  },
  {
    key: 'preparation',
    headings: ['PREPARAÇÃO'],
    kind: CanonicalSectionKind.TEXT_OR_LIST,
  },
  {
    key: 'steps',
    headings: ['PASSO A PASSO'],
    kind: CanonicalSectionKind.LIST,
  },
  {
    key: 'rulesAndSafety',
    headings: ['REGRAS E SEGURANÇA'],
    kind: CanonicalSectionKind.TEXT_OR_LIST,
  },
  {
    key: 'biblicalPrinciple',
    headings: ['PRINCÍPIO BÍBLICO'],
    kind: CanonicalSectionKind.TEXT,
  },
  {
    key: 'splitRationale',
    headings: ['CRITÉRIO DA DIVISÃO'],
    kind: CanonicalSectionKind.TEXT,
  },
  {
    key: 'evaluation',
    headings: ['COMO AVALIAR'],
    kind: CanonicalSectionKind.TEXT,
  },
];

export const GAME_AGE_ADAPTATIONS_KEY = 'ageAdaptations';
export const GAME_AGE_ADAPTATIONS_HEADINGS = ['ADAPTAÇÕES POR IDADE'] as const;

/** Sub-sections rendered under ADAPTAÇÕES POR IDADE. */
export const GAME_AGE_ADAPTATION_SECTIONS: readonly CanonicalSectionField[] = [
  {
    key: 'ages5To7',
    headings: ['CRIANÇAS DE 5 A 7 ANOS', 'AGES5TO7'],
    kind: CanonicalSectionKind.TEXT,
  },
  {
    key: 'ages8To11',
    headings: ['CRIANÇAS DE 8 A 11 ANOS', 'AGES8TO11'],
    kind: CanonicalSectionKind.TEXT,
  },
];

/** Stages whose structured data is produced only by generation, never by the editor. */
export const SERVER_AUTHORITATIVE_STAGES: readonly LessonStageType[] = [
  LessonStageType.LESSON_VISUALS,
  LessonStageType.VERSE_VISUALS,
  LessonStageType.MANUAL_WORK,
];

/**
 * `Livro capítulo[:versículo]`, with ranges and lists: "João 3:16",
 * "1 Coríntios 13:4-7", "Salmos 23.1", "Mateus 5:3-12; 6:1", "Judas 3".
 */
export const BIBLE_REFERENCE_PATTERN =
  /^\(?(?:[1-3]\s*[ªºo]?\s*)?\p{L}[\p{L}.]*(?:\s+\p{L}[\p{L}.]*)*\s+\d{1,3}(?:\s*[:.]\s*\d{1,3}[a-c]?)?(?:\s*[-–,;e]\s*\d{1,3}(?:\s*[:.]\s*\d{1,3}[a-c]?)?)*\)?$/u;

/** " — NVI", "(NVI)" and repeats of it at the end of a verse reference. */
export const LESSON_VERSE_REFERENCE_VERSION_SUFFIX =
  /(?:\s*(?:[—–-]\s*)?\(?NVI\)?)+$/i;
/** "(trecho)", "— trecho" or ", trecho" closing a verse reference. */
export const LESSON_VERSE_REFERENCE_EXCERPT_SUFFIX =
  /\s*(?:[—–,-]\s*)?\(?\s*trecho\s*\)?\s*$/i;
/** "Trecho de …" opening a verse reference. */
export const LESSON_VERSE_REFERENCE_EXCERPT_PREFIX = /^trecho\s+(?:de\s+)?/i;

/** A trailing Bible-version token such as "NVI", "(NVI)" or "ARA". */
export const BIBLE_VERSION_PATTERN = /^\(?(\p{Lu}{2,5})\)?$/u;
