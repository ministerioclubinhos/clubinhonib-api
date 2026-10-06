import { buildMeditationActivityImagePrompt } from './meditation-image.utils';

export function buildYoungerMeditationImagePrompt(
  instruction: string,
  proposedComposition: string,
  answer = '',
): string {
  return buildMeditationActivityImagePrompt(
    '4 a 7 anos',
    instruction,
    proposedComposition,
    answer,
  );
}
