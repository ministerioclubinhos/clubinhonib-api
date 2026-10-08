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
}
