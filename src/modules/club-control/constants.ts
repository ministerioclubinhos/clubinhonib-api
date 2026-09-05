/**
 * Conjuntos finitos do controle de clubinhos.
 *
 * Os status circulavam como string solta entre `ClubStatusService`,
 * `ClubWeekCheckService` e a montagem do resumo. O enum abaixo é o que os
 * avisos por e-mail usam; o restante do módulo ainda compara com literais, e
 * padronizar aquilo é uma limpeza à parte — os valores aqui são exatamente os
 * que `determineStatus` produz.
 */
export enum ClubWeekStatus {
  /** Todas as crianças com pagela lançada. */
  Ok = 'ok',
  /** Alguém lançou, mas nem todas. */
  Partial = 'partial',
  /** Nenhuma pagela na semana. */
  Missing = 'missing',
  /** O dia do clubinho ainda não chegou. */
  Pending = 'pending',
  /** Data marcada como dia sem Clubinho. */
  Exception = 'exception',
  /** Clubinho desativado. */
  Inactive = 'inactive',
  /** Semana fora do período letivo. */
  OutOfPeriod = 'out_of_period',
}

/**
 * Os status que geram cobrança no fim da semana.
 *
 * `pending` fica de fora: no domingo o dia do clubinho já passou para todos, e
 * um `pending` sobrando ali é sinal de semana futura, não de pagela esquecida.
 * `exception` também não entra — a coordenação já disse que não haveria
 * clubinho naquele dia.
 */
export const CLUB_WEEK_PENDING_STATUSES = [
  ClubWeekStatus.Missing,
  ClubWeekStatus.Partial,
] as const;

/** O status em texto legível, para o corpo do e-mail. */
export const CLUB_WEEK_STATUS_LABELS = {
  [ClubWeekStatus.Ok]: 'Pagelas em dia',
  [ClubWeekStatus.Partial]: 'Pagelas faltando',
  [ClubWeekStatus.Missing]: 'Nenhuma pagela lançada',
  [ClubWeekStatus.Pending]: 'Aguardando o dia do clubinho',
  [ClubWeekStatus.Exception]: 'Dia sem Clubinho',
  [ClubWeekStatus.Inactive]: 'Clubinho desativado',
  [ClubWeekStatus.OutOfPeriod]: 'Fora do período letivo',
} as const satisfies Record<ClubWeekStatus, string>;

/** Telas do painel para onde os avisos do clubinho apontam. */
export const CLUB_CONTROL_PATHS = {
  pagelas: 'adm/pagelas',
  control: 'adm/controle-clubinhos',
} as const;
