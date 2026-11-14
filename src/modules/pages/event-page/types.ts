import { Weekday } from 'src/modules/clubs/entities/weekday.enum';
import { EventAudience, EventType } from './entities/event.entity';

/** Campos do evento persistidos pelos casos de uso. */
export interface EventContent {
  title: string;
  date: string;
  location: string;
  description: string;
  audience: EventAudience;
  eventType?: EventType;
  public?: boolean;
  isRecurring?: boolean;
  weekday?: Weekday | null;
  time?: string | null;
  clubId?: string | null;
}

/** Dados do clubinho usados para montar o encontro semanal. */
export interface ClubMeetingSource {
  id: string;
  number: number;
  weekday: Weekday;
  time?: string | null;
  isActive: boolean;
  address?: {
    street?: string;
    number?: string;
    district?: string;
    city?: string;
    state?: string;
  } | null;
}

/** Situação da série de um clubinho, como a reconciliação precisa ler. */
export interface ClubMeetingSummary {
  clubId: string;
  /** Título gravado, para detectar linha com texto antigo. */
  title: string;
  /** Descrição gravada, pelo mesmo motivo. */
  description: string;
}

/** O que a reconciliação mexeu. */
export interface ReconcileClubEventsResult {
  /** Clubinhos ativos que estavam sem encontro no calendário. */
  created: number;
  /** Clubinhos inativos que ainda tinham dias no calendário. */
  removed: number;
  /** Encontros cujo título ou descrição estavam desatualizados. */
  refreshed: number;
  /** Clubinhos que já estavam corretos. */
  untouched: number;
}
