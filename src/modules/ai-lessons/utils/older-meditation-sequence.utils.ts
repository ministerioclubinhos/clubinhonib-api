import { createHash } from 'node:crypto';
import { OLDER_MEDITATION_LIMITS as L } from '../constants/older-meditation-contract.constants';
import type { MeditationJson } from '../types/younger-meditation.types';

function object(value: unknown): MeditationJson {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as MeditationJson)
    : {};
}
function text(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

export function olderMeditationSequenceIssue(
  activity: MeditationJson,
): string | null {
  const events = Array.isArray(activity.sequenceEvents)
    ? activity.sequenceEvents.map(object)
    : [];
  if (
    events.length < L.minimumSequenceEvents ||
    events.length > L.maximumSequenceEvents
  )
    return `A sequência precisa de ${L.minimumSequenceEvents}–${L.maximumSequenceEvents} acontecimentos estruturados, com relato, texto e ordem cronológica.`;
  const groups = new Map<string, MeditationJson[]>();
  for (const event of events) {
    if (
      !text(event.story) ||
      !text(event.text) ||
      !Number.isInteger(event.order)
    )
      return 'Cada acontecimento da sequência precisa de relato, texto e ordem inteira.';
    const key = text(event.story);
    groups.set(key, [...(groups.get(key) ?? []), event]);
  }
  for (const group of groups.values()) {
    const orders = group
      .map((event) => Number(event.order))
      .sort((a, b) => a - b);
    if (
      group.length < L.minimumSequenceEvents ||
      orders.some((order, index) => order !== index + 1)
    )
      return 'Cada relato da sequência precisa de pelo menos dois acontecimentos e posições cronológicas únicas de 1 a N.';
    if (
      new Set(group.map((event) => text(event.text).toLocaleLowerCase('pt-BR')))
        .size !== group.length
    )
      return 'A sequência repete um acontecimento dentro do mesmo relato.';
  }
  return null;
}

/** Printed identifiers are derived after shuffling; answer keys never depend on numeric sorting. */
export function normalizeOlderMeditationSequence(
  activity: MeditationJson,
): MeditationJson {
  if (olderMeditationSequenceIssue(activity)) return activity;
  const events = (activity.sequenceEvents as unknown[]).map(object);
  const stories = [...new Set(events.map((event) => text(event.story)))];
  const normalizedEvents: MeditationJson[] = [];
  const supports: string[] = [];
  const subitems: MeditationJson[] = [];
  for (const story of stories) {
    const chronological = events
      .filter((event) => text(event.story) === story)
      .sort((a, b) => Number(a.order) - Number(b.order));
    const shuffled = [...chronological].sort((a, b) =>
      createHash('sha256')
        .update(`${story}:${text(a.text)}`)
        .digest('hex')
        .localeCompare(
          createHash('sha256')
            .update(`${story}:${text(b.text)}`)
            .digest('hex'),
        ),
    );
    if (
      shuffled.every(
        (event, index) => event.order === chronological[index].order,
      )
    )
      shuffled.push(shuffled.shift()!);
    const printed = shuffled.map((event, index) => ({
      story,
      text: text(event.text),
      order: Number(event.order),
      displayedId: index + 1,
    }));
    normalizedEvents.push(...printed);
    supports.push(
      `Relato: ${story}\n${printed.map((event) => `${event.displayedId}) ${event.text}`).join('\n')}`,
    );
    subitems.push({
      prompt: `${story}: ordem dos números ____________________`,
      options: [],
      answer: [...printed]
        .sort((a, b) => a.order - b.order)
        .map((event) => event.displayedId)
        .join(', '),
    });
  }
  return {
    ...activity,
    command:
      'Coloque os acontecimentos de cada relato em ordem. Escreva os números da lista na sequência correta.',
    sequenceEvents: normalizedEvents,
    supportText: supports.join('\n'),
    subitems,
  };
}

export function olderMeditationSequenceKeyMatches(
  activity: MeditationJson,
): boolean {
  if (olderMeditationSequenceIssue(activity)) return false;
  const expected = normalizeOlderMeditationSequence(activity);
  const actualItems = Array.isArray(activity.subitems)
    ? activity.subitems.map(object)
    : [];
  const expectedItems = expected.subitems as MeditationJson[];
  return (
    activity.supportText === expected.supportText &&
    actualItems.length === expectedItems.length &&
    actualItems.every(
      (item, index) => text(item.answer) === text(expectedItems[index].answer),
    )
  );
}
