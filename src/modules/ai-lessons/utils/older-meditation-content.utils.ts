import {
  extractMeditationSectionText,
  meditationRichNodes,
  meditationNodeText,
} from './meditation-rich-text.utils';
import { MEDITATION_ACTIVITY_FIELDS } from '../constants/meditation-formatting.constants';
import { repairMeditationWordSearch } from './repair-meditation-word-search.utils';
import type { MeditationJson } from '../types/younger-meditation.types';
import { editedYoungerMeditation } from './younger-meditation-content.utils';

export function editedOlderMeditation(
  data: MeditationJson,
  document: MeditationJson | null,
): MeditationJson {
  const content = editedYoungerMeditation(data, document);
  if (!document) return repairMeditationWordSearch(content);
  const biblicalText = extractMeditationSectionText(document, 'TEXTO BÍBLICO');
  const introduction =
    extractMeditationSectionText(document, 'ENTENDENDO A LIÇÃO') ??
    extractMeditationSectionText(document, 'INTRODUÇÃO');
  const edited: MeditationJson = {
    ...content,
    ...(Array.isArray(content.activities)
      ? {
          activities: (content.activities as MeditationJson[]).map(
            (activity, index) => {
              const richNodes = meditationRichNodes(
                document,
                `activity${index + 1}`,
              );
              return richNodes.length
                ? {
                    ...activity,
                    instruction: richNodes.map(meditationNodeText).join('\n'),
                  }
                : activity;
            },
          ),
        }
      : {}),
    ...(biblicalText !== null ? { biblicalText } : {}),
    ...(introduction !== null ? { introduction } : {}),
  };
  const repaired = repairMeditationWordSearch(edited);
  const previousActivities = Array.isArray(edited.activities)
    ? (edited.activities as MeditationJson[])
    : [];
  const activities = Array.isArray(repaired.activities)
    ? (repaired.activities as MeditationJson[])
    : [];
  let nodes = Array.isArray(document.content)
    ? (document.content as MeditationJson[])
    : [];
  activities.forEach((activity, index) => {
    if (activity.instruction === previousActivities[index]?.instruction) return;
    const oldNodes = meditationRichNodes(document, `activity${index + 1}`);
    nodes = nodes.filter((node) => !oldNodes.includes(node));
    nodes.push({
      type: 'paragraph',
      attrs: {
        ...((oldNodes[0]?.attrs as MeditationJson | undefined) ?? {}),
        meditationField: MEDITATION_ACTIVITY_FIELDS[index],
      },
      content: [{ type: 'text', text: activity.instruction }],
    });
  });
  return {
    ...repaired,
    meditationDocument: { ...document, content: nodes },
  };
}
