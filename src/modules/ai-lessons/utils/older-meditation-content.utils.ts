import { extractTiptapSectionText } from '../utils';
import type { MeditationJson } from '../types/younger-meditation.types';
import { editedYoungerMeditation } from './younger-meditation-content.utils';

export function editedOlderMeditation(
  data: MeditationJson,
  document: MeditationJson | null,
): MeditationJson {
  const content = editedYoungerMeditation(data, document);
  if (!document) return content;
  const biblicalText = extractTiptapSectionText(document, 'TEXTO BÍBLICO');
  const introduction =
    extractTiptapSectionText(document, 'ENTENDENDO A LIÇÃO') ??
    extractTiptapSectionText(document, 'INTRODUÇÃO');
  return {
    ...content,
    ...(biblicalText !== null ? { biblicalText } : {}),
    ...(introduction !== null ? { introduction } : {}),
  };
}
