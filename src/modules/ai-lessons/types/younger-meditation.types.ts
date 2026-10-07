export interface YoungerMeditationActivity {
  instruction: string;
  image?: Buffer;
}

export interface YoungerMeditationSheet {
  title: string;
  verse: string;
  prayer: string;
  logo: Buffer;
  document?: Record<string, unknown>;
  activities: YoungerMeditationActivity[];
}

export type MeditationJson = Record<string, unknown>;

export interface YoungerMeditationFit {
  textSize: number;
  imageHeight: number;
  titleSize: number;
  verseSize: number;
}
