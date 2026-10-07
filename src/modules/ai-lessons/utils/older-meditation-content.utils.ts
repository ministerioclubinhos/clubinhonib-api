import { extractMeditationSectionText } from './meditation-rich-text.utils';
import type { MeditationJson } from '../types/younger-meditation.types';
import { editedYoungerMeditation } from './younger-meditation-content.utils';

export function editedOlderMeditation(
  data: MeditationJson,
  document: MeditationJson | null,
): MeditationJson {
  const content = editedYoungerMeditation(data, document);
  if (!document) return content;
  const biblicalText = extractMeditationSectionText(document, 'TEXTO BÍBLICO');
  const introduction =
    extractMeditationSectionText(document, 'ENTENDENDO A LIÇÃO') ??
    extractMeditationSectionText(document, 'INTRODUÇÃO');
  return {
    ...content,
    ...(biblicalText !== null ? { biblicalText } : {}),
    ...(introduction !== null ? { introduction } : {}),
  };
}
