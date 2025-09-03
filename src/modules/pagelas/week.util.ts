// src/modules/pagelas/week.util.ts
export function getISOWeekYear(dateStr: string): { year: number; week: number } {
  const date = new Date(dateStr + 'T00:00:00Z'); // evita timezone
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  // quinta-feira ISO
  d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
  const year = d.getUTCFullYear();
  const yearStart = new Date(Date.UTC(year, 0, 1));
  const week = Math.ceil((((+d - +yearStart) / 86400000) + 1) / 7);
  return { year, week };
}
