import {
  OLDER_MEDITATION_MIN_ACTIVITY_WORDS,
  OLDER_MEDITATION_BLOCK_SUBITEMS,
} from '../constants/older-meditation-quality.constants';
import type { MeditationJson } from '../types/younger-meditation.types';
import { meditationWordSearchIssue } from './meditation-word-search.utils';

export function olderMeditationInstructionWords(value: unknown): number {
  if (typeof value !== 'string') return 0;
  // Spaced grid letters are puzzle cells, not prose that fills a question block.
  const prose = /caça[ -]palavras/i.test(value)
    ? value
        .split(/\r?\n/)
        .filter((line) => !/^[A-ZÀ-Ü\s]{4,}$/.test(line.trim()))
        .join(' ')
    : value;
  return prose.match(/\S+/g)?.length ?? 0;
}

export function mergeOlderMeditationBlock(
  content: MeditationJson,
  index: number,
  revised: MeditationJson,
  minimumWords: number,
): MeditationJson {
  const subitems = revised.subitems;
  const answers = revised.answers;
  if (
    typeof revised.context !== 'string' ||
    typeof revised.command !== 'string' ||
    !Array.isArray(subitems) ||
    !Array.isArray(answers) ||
    subitems.length !== OLDER_MEDITATION_BLOCK_SUBITEMS ||
    answers.length !== subitems.length ||
    [...(subitems as unknown[]), ...(answers as unknown[])].some(
      (value: unknown) => typeof value !== 'string' || !value.trim(),
    )
  )
    return content;
  const instruction = [
    revised.context,
    revised.command,
    ...(subitems as string[]).map(
      (value, number) => `${String.fromCharCode(97 + number)}) ${value}`,
    ),
  ].join('\n');
  if (olderMeditationInstructionWords(instruction) < minimumWords)
    return content;
  const activities = Array.isArray(content.activities)
    ? (content.activities as MeditationJson[])
    : [];
  const activity = activities[index];
  if (!activity) return content;
  const activityId =
    typeof activity.id === 'string'
      ? activity.id
      : typeof activity.number === 'number'
        ? String(activity.number)
        : String(index + 1);
  return {
    ...content,
    activities: activities.map((value, position) =>
      position === index
        ? {
            ...value,
            instruction,
            answer: (answers as string[])
              .map(
                (value, number) =>
                  `${String.fromCharCode(97 + number)}) ${value}`,
              )
              .join('\n'),
          }
        : value,
    ),
    ...(Array.isArray(content.printableAssets)
      ? {
          printableAssets: (content.printableAssets as unknown[]).filter(
            (value) =>
              !value ||
              typeof value !== 'object' ||
              (value as MeditationJson).id !== activityId,
          ),
        }
      : {}),
  };
}

export function olderMeditationLessonSource(
  content: MeditationJson | null,
): MeditationJson | null {
  if (!content) return null;
  return {
    title: content.title,
    biblicalReference: content.biblicalReference,
    story: content.story,
    memoryVerse: content.memoryVerse,
    purpose: content.purpose,
    applicationAndAppeal: content.applicationAndAppeal,
  };
}

export function olderMeditationExpansionContext(
  content: MeditationJson,
): string {
  const activities = Array.isArray(content.activities)
    ? content.activities
    : [];
  const counts = activities.map((value) => {
    const activity =
      value && typeof value === 'object' ? (value as MeditationJson) : {};
    return olderMeditationInstructionWords(activity.instruction);
  });
  return [
    `A versão anterior tem ${counts.reduce((sum, count) => sum + count, 0)} palavras nas instruções. Contagem por bloco: ${counts.join(', ')}. Cabeçalho, introdução, oração, gabarito e prompt de imagem NÃO contam.`,
    'EDITE a versão abaixo, preservando os fatos corretos. Desenvolva cada instruction para cerca de 100–140 palavras: contexto breve, 4–6 subitens completos, alternativas ou pistas e aplicação. Não acrescente texto repetitivo. Coloque todos os subitens na string instruction; answer contém somente o gabarito. Retorne o JSON completo corrigido, não um resumo ou lista de mudanças.',
    `VERSÃO A CORRIGIR:\n${JSON.stringify(content)}`,
  ].join('\n');
}

export function olderMeditationContentIssue(
  content: MeditationJson,
): string | null {
  const activities = Array.isArray(content.activities)
    ? content.activities
    : [];
  if (activities.length !== 3)
    return 'São necessários três blocos de desafios completos.';
  const instructions = activities.map((value) => {
    const activity =
      value && typeof value === 'object' ? (value as MeditationJson) : {};
    return typeof activity.instruction === 'string'
      ? activity.instruction.trim()
      : '';
  });
  if (instructions.some((value) => !value))
    return 'Há um desafio sem instrução.';
  for (const instruction of instructions) {
    const issue = meditationWordSearchIssue(instruction);
    if (issue) return issue;
  }
  const words = instructions.reduce(
    (sum, instruction) => sum + olderMeditationInstructionWords(instruction),
    0,
  );
  return words < OLDER_MEDITATION_MIN_ACTIVITY_WORDS
    ? `As questões têm pouco conteúdo para uma folha inteira (${words} palavras; mínimo ${OLDER_MEDITATION_MIN_ACTIVITY_WORDS}); desenvolva subitens, pistas e alternativas.`
    : null;
}
