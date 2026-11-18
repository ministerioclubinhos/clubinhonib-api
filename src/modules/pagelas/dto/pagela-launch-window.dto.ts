import { PagelaLaunchClosedReason } from '../enums/pagela-launch-closed-reason.enum';

/** Resposta de `GET /pagelas/launch-window`. */
export class PagelaLaunchWindowDto {
  /** `true` quando hoje está dentro do período letivo. */
  open: boolean;
  reason: PagelaLaunchClosedReason | null;
  /** Explicação pronta para a tela quando `open` é `false`. */
  message: string | null;
  /** Hoje no fuso do Clubinho, em `YYYY-MM-DD`. */
  today: string;
  year: number | null;
  /** Semana letiva de hoje; a maior que aceita lançamento. */
  currentWeek: number | null;
  totalWeeks: number | null;
  startDate: string | null;
  endDate: string | null;
}
