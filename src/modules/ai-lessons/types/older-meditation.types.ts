export interface OlderMeditationSheet {
  title: string;
  verse: string;
  biblicalText: string;
  introduction: string;
  prayer: string;
  logo: Buffer;
  document?: Record<string, unknown>;
  activities: Array<{ instruction: string; image?: Buffer }>;
}

export interface OlderMeditationFit {
  fontSize: number;
  imageHeight: number;
  weights: number[];
  activitySpace: number;
  fits: boolean;
}

export interface OlderMeditationReviewIssue {
  activityNumber: number;
  reason: string;
}

/** A puzzle drawn by the server: what is printed and its answer key. */
export interface OlderMeditationPuzzle {
  supportText: string;
  answer: string;
}

export interface OlderMeditationCrosswordPlacement {
  word: string;
  /** Clue number: the position of the subitem, starting at 1. */
  number: number;
  row: number;
  column: number;
  across: boolean;
}

export interface OlderMeditationCrossword extends OlderMeditationPuzzle {
  /** Direction of each clue, in clue order. */
  directions: Array<'horizontal' | 'vertical'>;
}
