import { MeditationEntity } from '../entities/meditation.entity';
import { DayEntity, WeekDay } from '../entities/day.entity';
import { MediaItemEntity } from 'src/shared/media/media-item/media-item.entity';

export { WeekDay };

export class MediaItemDto {
  id: string;
  title: string;
  description: string;
  mediaType: 'video' | 'document' | 'image' | 'audio';
  typeUpload: 'link' | 'upload';
  url: string;
  isLocalFile: boolean;
  platformType?: 'youtube' | 'googledrive' | 'onedrive' | 'dropbox' | 'any';
  originalName?: string;
  size?: number;
  createdAt?: Date;
  updatedAt?: Date;

  static fromEntity(entity: MediaItemEntity): MediaItemDto {
    return {
      id: entity.id,
      title: entity.title,
      description: entity.description,
      mediaType: entity.mediaType as 'video' | 'document' | 'image' | 'audio',
      typeUpload: entity.uploadType as 'link' | 'upload',
      url: entity.url,
      isLocalFile: entity.isLocalFile,
      platformType:
        (entity.platformType as MediaItemDto['platformType']) ?? undefined,
      originalName: entity.originalName ?? undefined,
      size: entity.size ?? undefined,
      createdAt: entity.createdAt,
      updatedAt: entity.updatedAt,
    };
  }
}

export class MeditationDayDto {
  id: string;
  day: WeekDay;
  verse: string;
  topic: string;
  createdAt: Date;
  updatedAt: Date;

  static fromEntity(entity: DayEntity): MeditationDayDto {
    return {
      id: entity.id,
      day: entity.day,
      verse: entity.verse,
      topic: entity.topic,
      createdAt: entity.createdAt,
      updatedAt: entity.updatedAt,
    };
  }
}

export class MeditationDto {
  id: string;
  topic: string;
  startDate: Date;
  endDate: Date;
  days: MeditationDayDto[];
  media: MediaItemDto | null;
  createdAt: Date;
  updatedAt: Date;

  static fromEntity(
    meditation: MeditationEntity,
    media: MediaItemEntity | null,
  ): MeditationDto {
    return {
      id: meditation.id,
      topic: meditation.topic,
      startDate: meditation.startDate,
      endDate: meditation.endDate,
      createdAt: meditation.createdAt,
      updatedAt: meditation.updatedAt,
      days: meditation.days.map((day) => MeditationDayDto.fromEntity(day)),
      media: media ? MediaItemDto.fromEntity(media) : null,
    };
  }
}

export class WeekMeditationResponseDto {
  status: string;
  meditation: MeditationDto | null;

  static success(
    meditation: MeditationEntity,
    media: MediaItemEntity | null,
  ): WeekMeditationResponseDto {
    return {
      status: 'Meditação da Semana',
      meditation: MeditationDto.fromEntity(meditation, media),
    };
  }

  static notFound(): WeekMeditationResponseDto {
    return {
      status: 'Meditação não encontrada',
      meditation: null,
    };
  }
}
