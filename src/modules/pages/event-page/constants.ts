import { MediaTargetType } from 'src/shared/media/media-target-type.enum';

/** Caminho da agenda no site, para onde os avisos de evento apontam. */
export const EVENT_AGENDA_PATH = 'eventos';

/** Alvo polimórfico da mídia do evento. */
export const EVENT_MEDIA_TARGET_TYPE = MediaTargetType.Event;

/** Campo multipart que carrega o JSON das requisições. */
export const EVENT_PAYLOAD_FIELD = 'eventData';

/** Campo multipart do arquivo enviado. */
export const EVENT_FILE_FIELD = 'file';

/** Título do encontro semanal, por número do clubinho. */
export const clubMeetingTitle = (clubNumber: number): string =>
  `Clubinho #${clubNumber}`;

/** Descrição do encontro semanal. */
export const clubMeetingDescription = (clubNumber: number): string =>
  `Encontro semanal do Clubinho #${clubNumber}.`;

/** Texto usado quando o clubinho não tem endereço cadastrado. */
export const CLUB_MEETING_LOCATION_FALLBACK = 'Endereço não informado';

/** Horário usado quando o clubinho não tem horário cadastrado. */
export const CLUB_MEETING_TIME_FALLBACK = 'Horário a definir';
