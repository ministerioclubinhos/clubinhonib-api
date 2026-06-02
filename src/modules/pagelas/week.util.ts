export function getISOWeekYear(dateStr: string): {
  year: number;
  week: number;
} {
  const date = new Date(dateStr + 'T00:00:00Z');
  const d = new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()),
  );
  d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
  const year = d.getUTCFullYear();
  const yearStart = new Date(Date.UTC(year, 0, 1));
  const week = Math.ceil(((+d - +yearStart) / 86400000 + 1) / 7);
  return { year, week };
}

export function getAcademicWeekYear(
  referenceDate: string,
  periodStartDate: string,
  periodEndDate: string,
  periodYear: number,
): { year: number; week: number } {
  const refDate = new Date(referenceDate + 'T00:00:00');
  const startDate = new Date(periodStartDate + 'T00:00:00');
  const endDate = new Date(periodEndDate + 'T23:59:59');

  if (refDate < startDate || refDate > endDate) {
    throw new Error(
      `Data ${referenceDate} está fora do período letivo (${periodStartDate} a ${periodEndDate})`,
    );
  }

  const getWeekStartDate = (date: Date): Date => {
    const d = new Date(date);
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1);
    return new Date(d.setDate(diff));
  };

  const startWeekStart = getWeekStartDate(startDate);
  const refWeekStart = getWeekStartDate(refDate);

  const daysDiff = Math.floor(
    (refWeekStart.getTime() - startWeekStart.getTime()) / (1000 * 60 * 60 * 24),
  );

  const week = Math.floor(daysDiff / 7) + 1;

  return {
    year: periodYear,
    week: Math.max(1, week),
  };
}
