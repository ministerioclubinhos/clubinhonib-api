/** What the cover shows, decided before the image is drawn. */
export interface LessonCoverBrief {
  /** Short title written on the image, already in capital letters. */
  headline: string;
  character: {
    name: string;
    appearance: string;
  };
  scene: string;
  palette: string[];
  /** `AI` when the text model wrote it, `FALLBACK` when it came from the lesson alone. */
  origin: 'AI' | 'FALLBACK';
}
