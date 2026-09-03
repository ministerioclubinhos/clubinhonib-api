/** Papéis que podem administrar clubinhos. Professor só enxerga o próprio. */
export const CLUB_MANAGER_ROLES = ['admin', 'coordinator'] as const;

/** Paginação padrão da listagem. */
export const CLUBS_DEFAULT_PAGE = 1;
export const CLUBS_DEFAULT_LIMIT = 10;

/** Campos aceitos na ordenação, e o padrão. */
export const CLUB_SORT_FIELDS = [
  'number',
  'weekday',
  'time',
  'createdAt',
  'updatedAt',
  'city',
  'state',
] as const;

export const CLUB_DEFAULT_SORT = 'number';
export const CLUB_DEFAULT_ORDER = 'ASC';

/** Coluna correspondente a cada campo de ordenação aceito. */
export const CLUB_SORT_COLUMNS = {
  number: 'club.number',
  weekday: 'club.weekday',
  time: 'club.time',
  createdAt: 'club.createdAt',
  updatedAt: 'club.updatedAt',
  city: 'address.city',
  state: 'address.state',
} as const satisfies Record<(typeof CLUB_SORT_FIELDS)[number], string>;

/** Formato aceito no horário do encontro: `H:mm` ou `HH:mm`. */
export const CLUB_TIME_PATTERN = /^([01]?\d|2[0-3]):([0-5]\d)$/;

/** Texto usado quando o clubinho não tem bairro cadastrado. */
export const CLUB_DISTRICT_FALLBACK = '—';
