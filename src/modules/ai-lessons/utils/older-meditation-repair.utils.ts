import {
  OlderMeditationGoal as Goal,
  OlderMeditationMechanic as Mechanic,
} from '../enums/older-meditation.enums';
import type { MeditationJson } from '../types/younger-meditation.types';

const CHOICE_MARKER = /^\s*(?:\(\s*[a-e1-9]?\s*\)|[a-e1-9][.)\-:])\s*/i;

const TRUE_FALSE_SYNONYMS: Record<string, string> = {
  v: 'verdadeiro',
  certo: 'verdadeiro',
  correto: 'verdadeiro',
  sim: 'verdadeiro',
  f: 'falso',
  errado: 'falso',
  incorreto: 'falso',
  nao: 'falso',
};

const plain = (value: string): string =>
  value
    .replace(CHOICE_MARKER, '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();

const text = (value: unknown): string =>
  typeof value === 'string' ? value.trim() : '';

const withoutMarkdown = (value: unknown): unknown =>
  typeof value === 'string'
    ? value.replace(/\*\*/g, '').replace(/^\s*#{1,6}\s+/gm, '')
    : value;

/**
 * The option an answer key refers to, written exactly as the option: the
 * model often copies it with other punctuation, a "(B)" marker, or gives only
 * the letter or number of the option.
 */
export function matchChoiceAnswer(
  options: readonly string[],
  answer: string,
): string | null {
  const exact = options.find((option) => option === answer);
  if (exact) return exact;
  const letter = /^\s*\(?\s*([a-e1-9])\s*\)?[.)]?\s*$/i.exec(answer)?.[1];
  if (letter) {
    const index = /\d/.test(letter)
      ? Number(letter) - 1
      : letter.toLowerCase().charCodeAt(0) - 97;
    return options[index] ?? null;
  }
  // True/false keys written as "Certo", "V", "Errado" or "F".
  const truth = TRUE_FALSE_SYNONYMS[plain(answer)];
  if (truth) {
    const option = options.find((candidate) => plain(candidate) === truth);
    if (option) return option;
  }
  const target = plain(answer);
  const matches = options.filter((option) => plain(option) === target);
  return matches.length === 1 ? matches[0] : null;
}

/**
 * Fixes, without another AI call, details the local checks would otherwise
 * send back: choice answer keys that do not copy an option, stray Markdown
 * and an empty internal source excerpt.
 */
export function repairOlderMeditationActivity(
  activity: MeditationJson,
): MeditationJson {
  const choice = [Mechanic.MULTIPLE_CHOICE, Mechanic.TRUE_FALSE].includes(
    activity.mechanic as Mechanic,
  );
  const subitems = Array.isArray(activity.subitems)
    ? activity.subitems.map((raw) => {
        const item =
          raw && typeof raw === 'object' ? (raw as MeditationJson) : {};
        const options = Array.isArray(item.options)
          ? item.options.map((option) => text(withoutMarkdown(option)))
          : item.options;
        const answer = text(item.answer);
        const matched =
          choice && Array.isArray(options)
            ? matchChoiceAnswer(options, answer)
            : null;
        return {
          ...item,
          prompt: withoutMarkdown(item.prompt),
          options,
          answer: matched ?? item.answer,
        };
      })
    : activity.subitems;
  return {
    ...activity,
    context: withoutMarkdown(activity.context),
    command: withoutMarkdown(activity.command),
    sourceExcerpt: text(activity.sourceExcerpt) || text(activity.context),
    subitems,
  };
}

/**
 * The goals are internal labels: the first question recalls the story and,
 * when none is comprehension or application, the last one applies it.
 */
export function repairOlderMeditationGoals(
  activities: MeditationJson[],
): MeditationJson[] {
  if (!activities.length) return activities;
  const fixed = activities.map((activity, index) =>
    index === 0 ? { ...activity, goal: Goal.NARRATIVE } : activity,
  );
  if (
    fixed.length > 1 &&
    !fixed.some((activity) => activity.goal !== Goal.NARRATIVE)
  )
    fixed[fixed.length - 1] = {
      ...fixed[fixed.length - 1],
      goal: Goal.APPLICATION,
    };
  return fixed;
}
