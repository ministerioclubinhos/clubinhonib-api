import {
  getAcademicWeek,
  getISOWeek,
  referenceYearOf,
} from './academic-week.util';

/** Período letivo de 2026: começa numa segunda e termina num sábado. */
const periodo = {
  year: 2026,
  startDate: '2026-03-02',
  endDate: '2026-12-19',
};

describe('getAcademicWeek', () => {
  it('o primeiro dia do período é a semana 1', () => {
    expect(getAcademicWeek('2026-03-02', periodo)).toEqual({
      year: 2026,
      week: 1,
    });
  });

  it('a semana vai de segunda a domingo', () => {
    // 08/03 é domingo: ainda é a semana 1, porque a contagem parte da segunda.
    expect(getAcademicWeek('2026-03-08', periodo)).toEqual({
      year: 2026,
      week: 1,
    });
    // 09/03 é a segunda seguinte: vira semana 2.
    expect(getAcademicWeek('2026-03-09', periodo)).toEqual({
      year: 2026,
      week: 2,
    });
  });

  it('data fora do período devolve null', () => {
    // Quem chama decide se isso é erro do usuário ou um dia a ignorar.
    expect(getAcademicWeek('2026-03-01', periodo)).toBeNull();
    expect(getAcademicWeek('2026-12-20', periodo)).toBeNull();
  });

  it('o ano vem do período, não da data', () => {
    // Um período que atravessa a virada de ano continua contando as semanas do
    // ano letivo, e não do calendário.
    const atravessaOAno = {
      year: 2025,
      startDate: '2025-12-29',
      endDate: '2026-01-11',
    };

    expect(getAcademicWeek('2026-01-05', atravessaOAno)).toEqual({
      year: 2025,
      week: 2,
    });
  });

  it('não desloca o dia por fuso horário', () => {
    // `new Date('2026-03-02')` seria meia-noite UTC e, em fuso negativo,
    // cairia em 01/03 — fora do período, devolvendo null em vez da semana 1.
    expect(getAcademicWeek('2026-03-02', periodo)).not.toBeNull();
  });
});

describe('getISOWeek', () => {
  it('usa a quinta-feira da semana para decidir o ano', () => {
    // 01/01/2026 é quinta: a própria data define o ano ISO.
    expect(getISOWeek('2026-01-01')).toEqual({ year: 2026, week: 1 });
  });

  it('o domingo pertence à semana que começou na segunda anterior', () => {
    expect(getISOWeek('2026-01-04')).toEqual({ year: 2026, week: 1 });
    expect(getISOWeek('2026-01-05')).toEqual({ year: 2026, week: 2 });
  });
});

describe('referenceYearOf', () => {
  it('lê o ano sem passar por fuso', () => {
    expect(referenceYearOf('2026-01-01')).toBe(2026);
    expect(referenceYearOf('2025-12-31')).toBe(2025);
  });
});
