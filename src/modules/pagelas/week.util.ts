/**
 * Calcula a semana ISO e o ano ISO de uma data
 * @deprecated Usar getAcademicWeekYear para calcular semana do ano letivo
 */
export function getISOWeekYear(dateStr: string): { year: number; week: number } {
  const date = new Date(dateStr + 'T00:00:00Z');
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
  const year = d.getUTCFullYear();
  const yearStart = new Date(Date.UTC(year, 0, 1));
  const week = Math.ceil((((+d - +yearStart) / 86400000) + 1) / 7);
  return { year, week };
}

/**
 * Calcula a semana do ANO LETIVO e o ano letivo baseado em uma data e um período letivo
 * 
 * REGRA CRÍTICA: A primeira semana dentro do período letivo é a "semana 1" do ano letivo
 * 
 * @param referenceDate - Data de referência (YYYY-MM-DD)
 * @param periodStartDate - Data de início do período letivo (YYYY-MM-DD)
 * @param periodEndDate - Data de fim do período letivo (YYYY-MM-DD)
 * @param periodYear - Ano do período letivo (ex: 2024)
 * @returns { year: number, week: number } - Ano letivo e semana do ano letivo
 * @throws Error se a data estiver fora do período letivo
 */
export function getAcademicWeekYear(
  referenceDate: string,
  periodStartDate: string,
  periodEndDate: string,
  periodYear: number
): { year: number; week: number } {
  const refDate = new Date(referenceDate + 'T00:00:00');
  const startDate = new Date(periodStartDate + 'T00:00:00');
  const endDate = new Date(periodEndDate + 'T23:59:59');
  
  // Verificar se a data está dentro do período letivo
  if (refDate < startDate || refDate > endDate) {
    throw new Error(
      `Data ${referenceDate} está fora do período letivo (${periodStartDate} a ${periodEndDate})`
    );
  }

  // Obter o início da semana (segunda-feira) para ambas as datas
  const getWeekStartDate = (date: Date): Date => {
    const d = new Date(date);
    const day = d.getDay(); // 0 = domingo, 1 = segunda, ..., 6 = sábado
    const diff = d.getDate() - day + (day === 0 ? -6 : 1); // Ajustar para segunda-feira
    return new Date(d.setDate(diff));
  };

  const startWeekStart = getWeekStartDate(startDate);
  const refWeekStart = getWeekStartDate(refDate);

  // Calcular diferença em dias
  const daysDiff = Math.floor(
    (refWeekStart.getTime() - startWeekStart.getTime()) / (1000 * 60 * 60 * 24)
  );

  // Calcular semana do ano letivo (primeira semana é semana 1)
  // Se startWeekStart e refWeekStart são a mesma semana, semana = 1
  // Se refWeekStart é 7 dias depois, semana = 2, etc.
  const week = Math.floor(daysDiff / 7) + 1;

  return {
    year: periodYear,
    week: Math.max(1, week),
  };
}
