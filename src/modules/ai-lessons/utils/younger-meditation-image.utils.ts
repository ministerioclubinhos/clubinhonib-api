import { YOUNGER_MEDITATION_LINE_ART_RULE } from '../constants/meditation-prompts.constants';
import { buildMeditationActivityImagePrompt } from './meditation-image.utils';

export function buildYoungerMeditationImagePrompt(
  instruction: string,
  proposedComposition: string,
  answer = '',
): string {
  return `${buildMeditationActivityImagePrompt(
    '5 a 8 anos',
    instruction,
    proposedComposition,
    answer,
  )}
${YOUNGER_MEDITATION_LINE_ART_RULE}`;
}
