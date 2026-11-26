import { MediaTargetType } from 'src/shared/media/media-target-type.enum';
import { WeekDay } from './entities/day.entity';

/** Prefixo aplicado ao path da rota pública de uma meditação. */
export const MEDITATION_ROUTE_PATH_PREFIX = 'meditacao_';

/** Imagem exibida no card da rota da meditação. */
export const MEDITATION_ROUTE_IMAGE_URL =
  'https://bucket-clubinho-galeria.s3.amazonaws.com/uploads/img_card.jpg';

/** Tipo da entidade usado na rota e como alvo polimórfico da mídia. */
export const MEDITATION_ENTITY_TYPE = MediaTargetType.Meditation;

/** Campo multipart que carrega o JSON das requisições de criação/edição. */
export const MEDITATION_PAYLOAD_FIELD = 'meditationData';

/** Campo multipart que carrega o arquivo da mídia. */
export const MEDITATION_FILE_FIELD = 'file';

/** Relações sempre carregadas junto da meditação. */
export const MEDITATION_RELATIONS = ['days'] as const;

/** Dias que compõem uma meditação semanal, na ordem de exibição. */
export const MEDITATION_WEEK_DAYS: readonly WeekDay[] = [
  WeekDay.Monday,
  WeekDay.Tuesday,
  WeekDay.Wednesday,
  WeekDay.Thursday,
  WeekDay.Friday,
];

/** Quantidade exata de dias exigida em uma meditação. */
export const MEDITATION_DAYS_COUNT = MEDITATION_WEEK_DAYS.length;

/** Dia da semana em que a meditação precisa começar (segunda-feira). */
export const MEDITATION_START_WEEKDAY = 1;

/** Dia da semana em que a meditação precisa terminar (sexta-feira). */
export const MEDITATION_END_WEEKDAY = 5;

/** Paginação padrão da listagem de meditações. */
export const MEDITATIONS_DEFAULT_PAGE = 1;
export const MEDITATIONS_DEFAULT_LIMIT = 12;
export const MEDITATIONS_MAX_LIMIT = 100;

/** Campos aceitos na ordenação, e o padrão. */
export const MEDITATION_SORT_FIELDS = [
  'startDate',
  'topic',
  'createdAt',
] as const;

export const MEDITATION_DEFAULT_SORT = 'startDate';
export const MEDITATION_DEFAULT_ORDER = 'DESC';

/** Coluna correspondente a cada campo de ordenação aceito. */
export const MEDITATION_SORT_COLUMNS = {
  startDate: 'meditation.startDate',
  topic: 'meditation.topic',
  createdAt: 'meditation.createdAt',
} as const satisfies Record<(typeof MEDITATION_SORT_FIELDS)[number], string>;

/** Recortes de período aceitos na listagem. */
export const MEDITATION_PERIOD_FILTERS = [
  'current',
  'upcoming',
  'past',
] as const;

/** Tamanho máximo do texto de busca. */
export const MEDITATION_SEARCH_MAX_LENGTH = 200;
