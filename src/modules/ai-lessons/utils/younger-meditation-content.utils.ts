import { extractTiptapSectionText } from '../utils';
import type { MeditationJson } from '../types/younger-meditation.types';

function nodeText(node: MeditationJson): string {
  if (node.type === 'hardBreak') return '\n';
  return typeof node.text === 'string'
    ? node.text
    : Array.isArray(node.content)
      ? node.content.map((child: MeditationJson) => nodeText(child)).join('')
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
  const verse = extractTiptapSectionText(document, 'VERSÍCULO PARA MEMORIZAR');
  const verseLines =
    verse
      ?.split(/\n+/)
      .map((line) => line.trim())
      .filter(Boolean) ?? [];
  const prayer = extractTiptapSectionText(document, 'FALANDO COM DEUS');
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
    if (node.type !== 'heading' || nodeText(node).trim() !== 'INSTRUÇÃO')
      return [];
    const remaining = nodes.slice(index + 1);
    const end = remaining.findIndex((item) => item.type === 'heading');
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
    ...(title ? { title: nodeText(title).trim() } : {}),
    ...(hasPrayer ? { prayer: prayer ?? '' } : {}),
    ...(verseLines[0]
      ? { verseText: verseLines[0].replace(/^[“"]|[”"]$/g, '') }
      : {}),
    ...(hasVerse
      ? { verseReference: (verseLines[1] ?? '').replace(/\s*—\s*NVI$/i, '') }
      : {}),
    activities: activities.map((activity, index) => ({
      ...activity,
      ...(instructions[index] !== undefined
        ? { instruction: instructions[index] }
        : {}),
    })),
  };
}
