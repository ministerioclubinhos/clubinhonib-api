import { MediaItemEntity } from 'src/shared/media/media-item/media-item.entity';
import { MeditationEntity } from './entities/meditation.entity';

/** Intervalo de datas de uma meditação, já normalizado para data local. */
export interface MeditationPeriod {
  startDate: Date;
  endDate: Date;
}

/** Campos da meditação persistidos pelos casos de uso. */
export interface MeditationContent {
  topic: string;
  startDate: string;
  endDate: string;
}

/** Meditação carregada junto da sua mídia. */
export interface MeditationWithMedia {
  meditation: MeditationEntity;
  media: MediaItemEntity | null;
}
