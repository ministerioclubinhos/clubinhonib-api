/**
 * As fórmulas das estatísticas, isoladas do banco e do Nest.
 *
 * Estavam escritas à mão em cada ponto de uso — a taxa de presença aparecia
 * quatro vezes, o arredondamento quinze — e nenhuma delas tinha teste. Uma
 * conta errada só aparecia quando alguém desconfiava do número na tela.
 *
 * Cada função abaixo declara numerador, denominador e o que acontece quando o
 * denominador é zero, como pede a §11.3. Todas são puras: nenhuma lê relógio,
 * banco ou variável de ambiente, e por isso todas são cobertas por fixture
 * exata em `metrics.utils.spec.ts`.
 */

import {
  ClubPerformance,
  ClubPerformanceCounts,
  CurrentAcademicWeek,
} from '../types';
import { parseDateOnly } from './date.utils';

/**
 * Uma data de calendário (`YYYY-MM-DD`), sem horário.
 *
 * `new Date('2016-09-06')` é interpretado como meia-noite **UTC**: num processo
 * em fuso negativo — o Brasil inteiro — isso vira o dia 5 local, e toda conta
 * baseada no dia do mês desliza um dia. Era assim que uma criança nascida no
 * dia 6 ficava um ano mais velha na véspera do aniversário.
 */
const DATA_SEM_HORARIO = /^\d{4}-\d{2}-\d{2}$/;

/** Interpreta a data preservando o dia, venha ela como texto ou como `Date`. */
function toLocalDate(value: string | Date): Date {
  if (value instanceof Date) return value;

  return DATA_SEM_HORARIO.test(value) ? parseDateOnly(value) : new Date(value);
}

/**
 * Pesos do índice de engajamento de uma criança.
 *
 * Presença vale menos que meditação e versículo porque estar presente é o
 * pré-requisito, não o objetivo. Somam 1.
 */
export const ENGAGEMENT_WEIGHTS = {
  presence: 0.3,
  meditation: 0.35,
  verse: 0.35,
} as const;

/**
 * Pesos do índice de desempenho de um clubinho.
 *
 * Presença e meditação pesam mais que atividade e decisões porque são medidas
 * semanais; as outras duas são acumuladas. Somam 1.
 */
export const CLUB_PERFORMANCE_WEIGHTS = {
  presenceRate: 0.3,
  meditationRate: 0.3,
  activityRate: 0.2,
  decisionRate: 0.2,
} as const;

/**
 * Percentual de `part` sobre `total`, em pontos de 0 a 100.
 *
 * Denominador zero devolve `0`, e não `NaN`: a tela mostra "0%" para um
 * clubinho sem pagela nenhuma, que é o que se espera de quem ainda não
 * registrou nada.
 */
export function percentage(part: number, total: number): number {
  return total > 0 ? (part / total) * 100 : 0;
}

/**
 * Taxa de presença, de 0 a 100.
 *
 * Numerador: presenças registradas. Denominador: presenças **esperadas** — uma
 * por criança matriculada por dia de clubinho (`utils/enrollment.utils.ts`) —,
 * e não as pagelas lançadas. Criança esperada sem pagela conta como ausente.
 *
 * Sem ninguém esperado a taxa é `0`. O teto de 100 cobre a pagela lançada num
 * dia que o calendário não esperava (um feriado, por exemplo): a presença
 * existe, mas não pode passar do todo.
 */
export function presenceRate(present: number, expected: number): number {
  return Math.min(100, percentage(present, expected));
}

/**
 * Taxa de presença quando a conta de esperados pode não existir.
 *
 * `expected` nulo significa "não há esperado para este recorte" — é o caso do
 * filtro por professor, em que quem lança a pagela não define quem devia
 * estar lá. Aí a taxa é a antiga, presentes ÷ pagelas lançadas.
 */
export function presenceRateOrPerPagela(
  present: number,
  totalPagelas: number,
  expected: number | null,
): number {
  return expected === null
    ? percentage(present, totalPagelas)
    : presenceRate(present, expected);
}

/**
 * Arredonda para uma casa decimal.
 *
 * É a precisão que as telas de estatística mostram; arredondar no fim evita
 * que o erro de cada parcela se acumule na média.
 */
export function roundToOneDecimal(value: number): number {
  return Math.round(value * 10) / 10;
}

/**
 * Variação percentual entre dois momentos.
 *
 * Numerador: `current - previous`. Denominador: `previous`.
 *
 * Sem base anterior não existe variação a calcular — devolve `0` em vez de
 * infinito. Uma queda a zero devolve `-100`.
 */
export function growthRate(current: number, previous: number): number {
  return previous > 0 ? ((current - previous) / previous) * 100 : 0;
}

/** Média aritmética; lista vazia vale `0`. */
export function average(sum: number, count: number): number {
  return count > 0 ? sum / count : 0;
}

/** Média de um campo numérico de uma lista, já arredondada. */
export function averageOf<T>(
  items: readonly T[],
  pick: (item: T) => number,
): number {
  const soma = items.reduce((total, item) => total + pick(item), 0);

  return roundToOneDecimal(average(soma, items.length));
}

/**
 * Índice de engajamento de uma criança, de 0 a 100.
 *
 * Numerador: contagens de presença, meditação e versículo, ponderadas por
 * `ENGAGEMENT_WEIGHTS`. Denominador: total de pagelas da criança no recorte.
 *
 * Sem pagela no recorte o índice é `0` — a criança não tem histórico para
 * pontuar, e não um engajamento ruim.
 */
export function engagementScore(counts: {
  presenceCount: number;
  meditationCount: number;
  verseCount: number;
  totalPagelas: number;
}): number {
  const { presenceCount, meditationCount, verseCount, totalPagelas } = counts;

  const ponderado =
    presenceCount * ENGAGEMENT_WEIGHTS.presence +
    meditationCount * ENGAGEMENT_WEIGHTS.meditation +
    verseCount * ENGAGEMENT_WEIGHTS.verse;

  return percentage(ponderado, totalPagelas);
}

/**
 * Índice de desempenho de um clubinho, de 0 a 100.
 *
 * Combina quatro taxas já calculadas, ponderadas por
 * `CLUB_PERFORMANCE_WEIGHTS`. Como as quatro já vêm em pontos de 0 a 100 e os
 * pesos somam 1, o resultado fica na mesma escala.
 */
export function clubPerformanceScore(rates: {
  presenceRate: number;
  meditationRate: number;
  activityRate: number;
  decisionRate: number;
}): number {
  return (
    rates.presenceRate * CLUB_PERFORMANCE_WEIGHTS.presenceRate +
    rates.meditationRate * CLUB_PERFORMANCE_WEIGHTS.meditationRate +
    rates.activityRate * CLUB_PERFORMANCE_WEIGHTS.activityRate +
    rates.decisionRate * CLUB_PERFORMANCE_WEIGHTS.decisionRate
  );
}

/**
 * Média de um campo, só entre os itens que têm o que medir.
 *
 * Quem não tem dado no recorte não tem taxa 0%: tem taxa nenhuma. Somar esses
 * zeros puxava a média de todo mundo para baixo — um clubinho novo, ainda sem
 * pagela, derrubava a média geral de presença.
 */
export function averageOfMeasured<T>(
  items: readonly T[],
  isMeasured: (item: T) => boolean,
  pick: (item: T) => number,
): number {
  return averageOf(items.filter(isMeasured), pick);
}

/**
 * As quatro taxas e o índice de desempenho de um clubinho.
 *
 * É a única conta do índice: o ranking, a ordenação e os filtros da listagem
 * de clubinhos e o número mostrado na tela saem todos daqui. Antes havia três
 * cópias, e duas delas dividiam decisões (não crianças) pelas crianças ativas
 * — a taxa passava de 100 e o índice também.
 *
 * - `presenceRate`: presenças ÷ presenças esperadas;
 * - `meditationRate`: meditações ÷ pagelas lançadas;
 * - `activityRate`: crianças com presença ÷ crianças esperadas;
 * - `decisionRate`: crianças com decisão ÷ crianças com presença.
 *
 * Toda taxa tem teto de 100, e por isso o índice também.
 */
export function clubPerformance(
  counts: ClubPerformanceCounts,
): ClubPerformance {
  const capped = (part: number, total: number) =>
    Math.min(100, percentage(part, total));

  const rates = {
    presenceRate: presenceRate(counts.presenceCount, counts.expectedPresences),
    meditationRate: capped(counts.meditationCount, counts.totalPagelas),
    activityRate: capped(counts.activeChildren, counts.expectedChildren),
    decisionRate: capped(counts.childrenWithDecisions, counts.activeChildren),
  };

  return {
    ...rates,
    performanceScore: Math.min(100, clubPerformanceScore(rates)),
    measured: counts.expectedPresences > 0 || counts.totalPagelas > 0,
  };
}

/**
 * Quantas semanas letivas seguidas a criança aparece, contando da mais recente.
 *
 * `weekKeys` chega da consulta como `"2026-12,2026-11,2026-9"`, já ordenado do
 * mais recente para o mais antigo. A contagem para na primeira falha: no
 * exemplo o resultado é `2`, porque a semana 10 falta.
 *
 * A virada de ano quebra a sequência de propósito — sem saber quantas semanas
 * teve o ano anterior, encadear 2025-52 com 2026-1 seria um chute.
 *
 * `anchor` é a semana letiva corrente. Com ela a sequência só vale se chegar
 * até agora: a semana mais recente precisa ser a corrente ou a anterior (o
 * clubinho desta semana pode ainda não ter acontecido). Sem a âncora, quem
 * veio cinco semanas seguidas em março e sumiu continuava com "5 semanas
 * seguidas" em novembro. `null` significa "fora do período letivo": não há
 * sequência em curso, e o resultado é `0`. Omitir o parâmetro mantém a conta
 * solta, a partir da semana mais recente que existir.
 */
export function consecutiveAcademicWeeks(
  weekKeys?: string,
  anchor?: CurrentAcademicWeek | null,
): number {
  if (!weekKeys) return 0;
  if (anchor === null) return 0;

  const semanas = weekKeys
    .split(',')
    .map((chave) => {
      const [year, week] = chave.split('-').map(Number);
      return { year, week };
    })
    .filter(({ year, week }) => Number.isFinite(year) && Number.isFinite(week))
    // Semana depois da corrente é lançamento adiantado: não é sequência.
    .filter(
      ({ year, week }) =>
        !anchor ||
        year < anchor.year ||
        (year === anchor.year && week <= anchor.week),
    );

  if (semanas.length === 0) return 0;

  if (anchor) {
    const maisRecente = semanas[0];
    const chegaAteAgora =
      maisRecente.year === anchor.year && anchor.week - maisRecente.week <= 1;
    if (!chegaAteAgora) return 0;
  }

  let seguidas = 1;
  for (let i = 1; i < semanas.length; i++) {
    const anterior = semanas[i - 1];
    const atual = semanas[i];

    if (anterior.year !== atual.year || anterior.week - atual.week !== 1) break;

    seguidas++;
  }

  return seguidas;
}

/**
 * Lê um número que a consulta raw devolveu como texto.
 *
 * O driver do MySQL entrega `COUNT`/`SUM` como string, e às vezes como `null`
 * quando não há linha. `parseInt` cru devolvia `NaN` nesses casos, que
 * contaminava toda soma seguinte.
 */
export function toCount(value: string | number | null | undefined): number {
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
  if (!value) return 0;

  const numero = Number.parseInt(value, 10);

  return Number.isFinite(numero) ? numero : 0;
}

/** Idade em anos completos na data de referência (hoje, por padrão). */
export function ageInYears(
  birthDate: string | Date,
  reference: Date = new Date(),
): number {
  const nascimento = toLocalDate(birthDate);
  let idade = reference.getFullYear() - nascimento.getFullYear();
  const mesesDeDiferenca = reference.getMonth() - nascimento.getMonth();

  // Ainda não fez aniversário neste ano.
  if (
    mesesDeDiferenca < 0 ||
    (mesesDeDiferenca === 0 && reference.getDate() < nascimento.getDate())
  ) {
    idade--;
  }

  return idade;
}

/** Faixa etária usada nas distribuições. */
export function ageGroup(age: number): string {
  if (age <= 5) return '0-5';
  if (age <= 10) return '6-10';
  if (age <= 15) return '11-15';
  return '16+';
}

/**
 * Meses completos desde a entrada no clubinho.
 *
 * Sem data de entrada o resultado é `0`, e nunca negativo: uma data futura
 * (digitação errada) não vira tempo de participação negativo.
 */
export function monthsParticipating(
  joinedAt: string | Date | null | undefined,
  reference: Date = new Date(),
): number {
  if (!joinedAt) return 0;

  const entrada = toLocalDate(joinedAt);
  const meses =
    (reference.getFullYear() - entrada.getFullYear()) * 12 +
    (reference.getMonth() - entrada.getMonth());

  return Math.max(0, meses);
}

/** Faixa de tempo de participação usada nas distribuições. */
export function participationTimeRange(months: number): string {
  if (months < 3) return '0-3 meses';
  if (months < 6) return '3-6 meses';
  if (months < 12) return '6-12 meses';
  return '1+ ano';
}
