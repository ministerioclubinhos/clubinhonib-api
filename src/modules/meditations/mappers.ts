import { MediaItemEntity } from 'src/shared/media/media-item/media-item.entity';
import { DayEntity } from './entities/day.entity';
import { MeditationEntity } from './entities/meditation.entity';
import {
  MeditationDayResponseDto,
  MeditationMediaResponseDto,
  MeditationResponseDto,
} from './dto/meditation-response.dto';
import { MEDITATION_WEEK_DAYS } from './constants';
import { formatDateOnly, parseDateAsLocal } from './utils';

/** Mapeia a mídia persistida para o contrato público. */
export function toMediaResponse(
  item: MediaItemEntity,
): MeditationMediaResponseDto {
  return {
    id: item.id,
    title: item.title,
    description: item.description,
    mediaType: item.mediaType,
    uploadType: item.uploadType,
    platformType: item.platformType,
    url: item.url,
    isLocalFile: item.isLocalFile,
    originalName: item.originalName,
    size: item.size,
  };
}

/** Mapeia um dia da meditação para o contrato público. */
export function toDayResponse(day: DayEntity): MeditationDayResponseDto {
  return {
    id: day.id,
    day: day.day,
    verse: day.verse,
    topic: day.topic,
  };
}

/** Ordena os dias de segunda a sexta, independentemente da ordem no banco. */
export function sortDays(days: DayEntity[]): DayEntity[] {
  return [...days].sort(
    (a, b) =>
      MEDITATION_WEEK_DAYS.indexOf(a.day) - MEDITATION_WEEK_DAYS.indexOf(b.day),
  );
}

/** Mapeia a meditação e sua mídia para o contrato público. */
export function toMeditationResponse(
  meditation: MeditationEntity,
  media: MediaItemEntity | null = null,
): MeditationResponseDto {
  return {
    id: meditation.id,
    topic: meditation.topic,
    startDate: formatDateOnly(parseDateAsLocal(meditation.startDate)),
    endDate: formatDateOnly(parseDateAsLocal(meditation.endDate)),
    days: sortDays(meditation.days ?? []).map(toDayResponse),
    media: media ? toMediaResponse(media) : null,
    createdAt: meditation.createdAt,
    updatedAt: meditation.updatedAt,
  };
}
