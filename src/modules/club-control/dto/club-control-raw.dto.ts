export interface PagelaChildIdRaw {
  childId: string;
}

/**
 * Uma criança do clubinho, no recorte que o resumo semanal usa.
 *
 * Só o que decide se ela conta numa semana: o vínculo, a data de entrada e se
 * ainda frequenta. Nome e dados pessoais não entram — o resumo mostra números,
 * e carregar o resto seria expor dado de criança sem necessidade.
 */
export interface SummaryChildRaw {
  childId: string;
  clubId: string;
  isActive: boolean;
  /** `YYYY-MM-DD`, ou `null` quando a entrada não foi registrada. */
  joinedAt: string | null;
}

/** Uma pagela lançada, no recorte que o resumo semanal usa. */
export interface SummaryPagelaRaw {
  childId: string;
  clubId: string;
  week: number;
  present: boolean;
}
