import {
  extractMeditationSectionText,
  meditationNodeText,
  meditationRichNodes,
} from './meditation-rich-text.utils';
import type { MeditationJson } from '../types/younger-meditation.types';

function nodeText(node: MeditationJson): string {
  if (node.type === 'hardBreak') return '\n';
  return typeof node.text === 'string'
    ? node.text
    : Array.isArray(node.content)
      ? node.content
          .map((child: MeditationJson) => nodeText(child))
          .join(
            ['bulletList', 'orderedList', 'listItem'].includes(
              String(node.type),
            )
              ? '\n'
              : '',
          )
      : '';
}

/** Preserve saved edits while recovering instructions omitted by legacy editor ASTs. */
export function editedYoungerMeditation(
  data: MeditationJson,
  document: MeditationJson | null,
): MeditationJson {
  if (!document) return data;
  const nodes = Array.isArray(document.content)
    ? (document.content as MeditationJson[])
    : [];
  const title = nodes.find(
    (node) =>
      node.type === 'heading' &&
      Number((node.attrs as MeditationJson)?.level) === 1 &&
      !/^MEDITAÇÃO|^LIÇÃO\s+\d|^TÍTULO$/i.test(nodeText(node).trim()),
  );
  const richTitleNodes = meditationRichNodes(document, 'title');
  const resolvedTitle = title
    ? nodeText(title).trim()
    : richTitleNodes.length
      ? richTitleNodes.map(meditationNodeText).join(' ').trim()
      : undefined;

  const verse = extractMeditationSectionText(
    document,
    'VERSÍCULO PARA MEMORIZAR',
  );
  const verseLines =
    verse
      ?.split(/\n+/)
      .map((line) => line.trim())
      .filter(Boolean) ?? [];
  const prayer = extractMeditationSectionText(document, 'FALANDO COM DEUS');
  const richPrayerNodes = meditationRichNodes(document, 'prayer');
  const hasPrayer = nodes.some(
    (node) =>
      node.type === 'heading' &&
      nodeText(node).trim().toUpperCase() === 'FALANDO COM DEUS',
  );
  const hasVerse = nodes.some(
    (node) =>
      node.type === 'heading' &&
      nodeText(node).trim().toUpperCase() === 'VERSÍCULO PARA MEMORIZAR',
  );
  const instructions = nodes.flatMap((node, index) => {
    if (
      node.type !== 'heading' ||
      (node.attrs as MeditationJson)?.meditationField ||
      nodeText(node).trim() !== 'INSTRUÇÃO'
    )
      return [];
    const remaining = nodes.slice(index + 1);
    const end = remaining.findIndex(
      (item) =>
        item.type === 'heading' &&
        !(item.attrs as MeditationJson)?.meditationField,
    );
    const instruction = (end < 0 ? remaining : remaining.slice(0, end))
      .map(nodeText)
      .join('\n')
      .trim();
    return [instruction];
  });
  const activities = Array.isArray(data.activities)
    ? (data.activities as MeditationJson[])
    : [];
  return {
    ...data,
    ...(nodes.length ? { meditationDocument: document } : {}),
    ...(resolvedTitle !== undefined ? { title: resolvedTitle } : {}),
    ...(hasPrayer
      ? { prayer: prayer ?? '' }
      : richPrayerNodes.length
        ? { prayer: richPrayerNodes.map(meditationNodeText).join('\n').trim() }
        : {}),
    ...(hasVerse
      ? {
          verseText: (verseLines[0] ?? '').replace(/^[“"]|[”"]$/g, ''),
          verseReference: (verseLines[1] ?? '').replace(/\s*—\s*NVI$/i, ''),
        }
      : verseLines[0]
        ? { verseText: verseLines[0].replace(/^[“"]|[”"]$/g, '') }
        : {}),
    activities: activities.map((activity, index) => {
      if (instructions[index] !== undefined) {
        return {
          ...activity,
          instruction: instructions[index],
        };
      }
      const richActivityNodes = meditationRichNodes(
        document,
        `activity${index + 1}`,
      );
      if (richActivityNodes.length) {
        return {
          ...activity,
          instruction: richActivityNodes
            .map(meditationNodeText)
            .join('\n')
            .trim(),
        };
      }
      return activity;
    }),
  };
}
