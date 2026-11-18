import {
  MediaType,
  PlatformType,
  UploadType,
} from 'src/shared/media/media-item/media-item.entity';
import { WeekDay } from '../entities/day.entity';

/** Contrato público da mídia associada a uma meditação. */
export class MeditationMediaResponseDto {
  id: string;
  title: string;
  description: string;
  mediaType: MediaType;
  uploadType: UploadType;
  platformType?: PlatformType;
  url: string;
  isLocalFile: boolean;
  originalName?: string;
  size?: number;
}

/** Contrato público de um dia da meditação. */
export class MeditationDayResponseDto {
  id: string;
  day: WeekDay;
  verse: string;
  topic: string;
}

/** Contrato público de uma meditação semanal. */
export class MeditationResponseDto {
  id: string;
  topic: string;
  /** Data no formato `YYYY-MM-DD`. */
  startDate: string;
  /** Data no formato `YYYY-MM-DD`. */
  endDate: string;
  days: MeditationDayResponseDto[];
  /** `null` quando a meditação ainda não tem mídia associada. */
  media: MeditationMediaResponseDto | null;
  createdAt: Date;
  updatedAt: Date;
}
