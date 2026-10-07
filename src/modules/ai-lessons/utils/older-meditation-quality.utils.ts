import { OLDER_MEDITATION_MIN_ACTIVITY_WORDS } from '../constants/older-meditation-quality.constants';
import type { MeditationJson } from '../types/younger-meditation.types';
import { meditationWordSearchIssue } from './meditation-word-search.utils';

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
    return typeof activity.instruction === 'string'
      ? (activity.instruction.match(/\S+/g)?.length ?? 0)
      : 0;
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
  const words = instructions.join(' ').match(/\S+/g)?.length ?? 0;
  return words < OLDER_MEDITATION_MIN_ACTIVITY_WORDS
    ? `As questões têm pouco conteúdo para uma folha inteira (${words} palavras; mínimo ${OLDER_MEDITATION_MIN_ACTIVITY_WORDS}); desenvolva subitens, pistas e alternativas.`
    : null;
}
