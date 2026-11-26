import { LESSON_NARRATIVE_QUOTE_PAIRS } from './constants/lesson-editorial.constants';
import { lessonString } from './utils';

export function lessonNarrativeIssue(value: unknown): string | null {
  const story = lessonString(value).trim();
  if (!story) return 'a narrativa está vazia';
  const straightQuotes = story.match(/(?<!\\)"/g)?.length ?? 0;
  if (straightQuotes % 2 !== 0)
    return 'há uma fala ou citação com aspas sem fechamento';
  for (const [opening, closing] of LESSON_NARRATIVE_QUOTE_PAIRS) {
    if (story.split(opening).length !== story.split(closing).length)
      return 'há uma fala ou citação com aspas sem fechamento';
  }
  if (/[:;,—–-]\s*$/.test(story))
    return 'a narrativa termina com um sinal de continuação';
  const sections = story.split(/^\s*###\s+[^\r\n]+\r?\n?/m).slice(1);
  if (sections.some((section) => !section.trim()))
    return 'há um subtítulo de história sem narrativa';
  return null;
}
