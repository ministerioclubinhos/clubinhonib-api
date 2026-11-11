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
  /** Minimum height given to the activities row, in twips. */
  activityRowHeight: number;
  /** Height reserved for the prayer strip that closes the half sheet, in twips. */
  prayerHeight: number;
  /** False when the texts cannot fit one half sheet even at the smallest size. */
  fits: boolean;
}
