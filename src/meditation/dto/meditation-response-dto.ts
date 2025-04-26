export enum WeekDay {
    Monday = 'Monday',
    Tuesday = 'Tuesday',
    Wednesday = 'Wednesday',
    Thursday = 'Thursday',
    Friday = 'Friday',
  }
  
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
  
    static fromEntity(entity: any): MediaItemDto {
      return {
        id: entity.id,
        title: entity.title,
        description: entity.description,
        mediaType: entity.mediaType,
        typeUpload: entity.type,
        url: entity.url,
        isLocalFile: entity.isLocalFile,
        platformType: entity.platformType ?? undefined,
        originalName: entity.originalName,
        size: entity.size,
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
  
    static fromEntity(entity: any): MeditationDayDto {
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
    media: MediaItemDto | null
    createdAt: Date;
    updatedAt: Date;
  
    static fromEntity(meditation: any, media: any): MeditationDto {
      return {
        id: meditation.id,
        topic: meditation.topic,
        startDate: meditation.startDate,
        endDate: meditation.endDate,
        createdAt: meditation.createdAt,
        updatedAt: meditation.updatedAt,
        days: meditation.days.map((day: any) => MeditationDayDto.fromEntity(day)),
        media: media ? MediaItemDto.fromEntity(media) : null,
    };
    }
  }
  
  export class WeekMeditationResponseDto {
    status: string;
    meditation: MeditationDto | null;
  
    static success(meditation: any, media: any): WeekMeditationResponseDto {
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
  