/**
 * Conversão de uma data em semana letiva.
 *
 * Mora em `shared` porque três módulos precisam da mesma conta — pagelas,
 * controle de clubinho e estatísticas. Antes ela vivia dentro de pagelas e os
 * outros dois importavam de lá, o que amarrava módulos que nada têm a ver
 * entre si.
 */

/** Semana e ano letivos. */
export interface AcademicWeek {
  year: number;
  week: number;
}

/** Período letivo cadastrado. */
export interface AcademicPeriod {
  year: number;
  /** `YYYY-MM-DD`. */
  startDate: string;
  /** `YYYY-MM-DD`. */
  endDate: string;
}

/**
 * Data `YYYY-MM-DD` lida ao meio-dia local.
 *
 * `new Date('2026-03-01')` seria meia-noite UTC e, em fuso negativo, cairia no
 * dia anterior. Ler ao meio-dia mantém o dia do calendário.
 */
export function parseDateOnly(value: string): Date {
  const [year, month, day] = value.split('-').map(Number);
  return new Date(year, (month ?? 1) - 1, day ?? 1, 12, 0, 0, 0);
}

/**
 * Formata uma data como `YYYY-MM-DD` a partir dos componentes locais.
 *
 * `toISOString()` converte para UTC antes de recortar: num processo em fuso
 * positivo, meia-noite local é o dia anterior em UTC e a data volta um dia.
 */
export function formatDateOnly(date: Date): string {
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');

  return `${date.getFullYear()}-${month}-${day}`;
}

/** Ano da data, sem passar por fuso. */
export function referenceYearOf(referenceDate: string): number {
  return parseDateOnly(referenceDate).getFullYear();
}

/** Segunda-feira da semana em que a data cai. */
function startOfWeek(date: Date): Date {
  const result = new Date(date);
  const weekday = result.getDay();
  const offset = weekday === 0 ? -6 : 1 - weekday;
  result.setDate(result.getDate() + offset);
  result.setHours(12, 0, 0, 0);
  return result;
}

/**
 * Semana letiva da data dentro do período.
 *
 * Devolve `null` quando a data está fora do período: quem chama decide se isso
 * é erro do usuário ou apenas um dia a ignorar.
 */
export function getAcademicWeek(
  referenceDate: string,
  period: AcademicPeriod,
): AcademicWeek | null {
  const reference = parseDateOnly(referenceDate);
  const start = parseDateOnly(period.startDate);
  const end = parseDateOnly(period.endDate);

  if (reference < start || reference > end) return null;

  const daysBetween = Math.floor(
    (startOfWeek(reference).getTime() - startOfWeek(start).getTime()) /
      (1000 * 60 * 60 * 24),
  );

  return {
    year: period.year,
    week: Math.max(1, Math.floor(daysBetween / 7) + 1),
  };
}

/** Semana ISO da data, usada quando não há período letivo cadastrado. */
export function getISOWeek(referenceDate: string): AcademicWeek {
  const date = parseDateOnly(referenceDate);
  const thursday = new Date(
    Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()),
  );
  thursday.setUTCDate(thursday.getUTCDate() + 4 - (thursday.getUTCDay() || 7));

  const year = thursday.getUTCFullYear();
  const yearStart = new Date(Date.UTC(year, 0, 1));
  const week = Math.ceil(
    ((thursday.getTime() - yearStart.getTime()) / 86400000 + 1) / 7,
  );

  return { year, week };
}
