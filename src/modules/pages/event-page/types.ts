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
