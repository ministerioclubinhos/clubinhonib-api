import {
  MediaType,
  PlatformType,
  UploadType,
} from 'src/shared/media/media-item/media-item.entity';
import { Weekday } from 'src/modules/clubs/entities/weekday.enum';
import { EventAudience, EventType } from '../entities/event.entity';

/** Mídia do evento no contrato público. */
export class EventMediaResponseDto {
  id: string;
  title: string;
  description: string;
  mediaType: MediaType;
  uploadType: UploadType;
  url: string;
  isLocalFile: boolean;
  platformType?: PlatformType;
  originalName?: string;
  size?: number;
  createdAt?: Date;
  updatedAt?: Date;
}

/** Contrato de resposta de `/events`. */
export class EventResponseDto {
  id: string;
  title: string;
  description: string;
  date: string;
  location: string;
  audience: EventAudience;
  eventType?: EventType;
  /** Um evento não público só é devolvido para quem está autenticado. */
  public: boolean;
  /** Encontro semanal: `weekday` e `time` valem para todas as semanas. */
  isRecurring: boolean;
  weekday: Weekday | null;
  /**
   * Dias em que o evento acontece, em `YYYY-MM-DD`.
   *
   * Um evento comum traz a própria data. Um encontro de clubinho traz uma data
   * por semana, já limitada ao período letivo e sem os dias de exceção — é o
   * campo que o calendário desenha. Vem vazio para nada: um evento sem nenhuma
   * data não é devolvido nas listagens.
   */
  occurrences: string[];
  time: string | null;
  /** Preenchido quando o evento veio de um clubinho. */
  clubId: string | null;
  media: EventMediaResponseDto | null;
  createdAt: Date;
  updatedAt: Date;
}
