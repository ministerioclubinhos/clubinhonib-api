import {
  CLUB_PERFORMANCE_WEIGHTS,
  ENGAGEMENT_WEIGHTS,
  ageGroup,
  ageInYears,
  average,
  averageOf,
  averageOfMeasured,
  clubPerformance,
  clubPerformanceScore,
  consecutiveAcademicWeeks,
  engagementScore,
  growthRate,
  monthsParticipating,
  participationTimeRange,
  percentage,
  presenceRate,
  presenceRateOrPerPagela,
  roundToOneDecimal,
  toCount,
} from './metrics.utils';

describe('pesos', () => {
  it('os pesos de engajamento somam 1', () => {
    // Se não somassem, o índice deixaria de ficar na escala de 0 a 100 e a
    // faixa de classificação na tela passaria a mentir.
    const soma = Object.values(ENGAGEMENT_WEIGHTS).reduce((a, b) => a + b, 0);

    expect(soma).toBeCloseTo(1, 10);
  });

  it('os pesos de desempenho de clubinho somam 1', () => {
    const soma = Object.values(CLUB_PERFORMANCE_WEIGHTS).reduce(
      (a, b) => a + b,
      0,
    );

    expect(soma).toBeCloseTo(1, 10);
  });
});

describe('percentage', () => {
  it('calcula a fração em pontos de 0 a 100', () => {
    expect(percentage(3, 4)).toBe(75);
    expect(percentage(1, 3)).toBeCloseTo(33.3333, 4);
  });

  it('denominador zero vale 0, não NaN', () => {
    // Um clubinho sem pagela nenhuma mostra 0%, e não "NaN%".
    expect(percentage(0, 0)).toBe(0);
    expect(percentage(5, 0)).toBe(0);
  });

  it('denominador negativo também vale 0', () => {
    expect(percentage(5, -2)).toBe(0);
  });
});

describe('roundToOneDecimal', () => {
  it('arredonda para uma casa', () => {
    expect(roundToOneDecimal(33.3333)).toBe(33.3);
    expect(roundToOneDecimal(66.6666)).toBe(66.7);
    expect(roundToOneDecimal(0)).toBe(0);
  });

  it('arredonda meio para cima', () => {
    expect(roundToOneDecimal(2.25)).toBe(2.3);
  });
});

describe('growthRate', () => {
  it('mede a variação sobre a base anterior', () => {
    expect(growthRate(120, 100)).toBe(20);
    expect(growthRate(80, 100)).toBe(-20);
    expect(growthRate(100, 100)).toBe(0);
  });

  it('sem base anterior devolve 0, não infinito', () => {
    // Sair de zero para dez não é "crescimento infinito": não há base.
    expect(growthRate(10, 0)).toBe(0);
  });

  it('queda a zero é -100%', () => {
    expect(growthRate(0, 40)).toBe(-100);
  });
});

describe('average / averageOf', () => {
  it('média simples', () => {
    expect(average(10, 4)).toBe(2.5);
  });

  it('lista vazia vale 0', () => {
    expect(average(0, 0)).toBe(0);
    expect(averageOf([], () => 1)).toBe(0);
  });

  it('média de um campo já vem arredondada', () => {
    const clubes = [{ nota: 10 }, { nota: 20 }, { nota: 25 }];

    // (10 + 20 + 25) / 3 = 18.3333…
    expect(averageOf(clubes, (c) => c.nota)).toBe(18.3);
  });
});

describe('engagementScore', () => {
  it('criança que fez tudo em toda pagela pontua 100', () => {
    expect(
      engagementScore({
        presenceCount: 10,
        meditationCount: 10,
        verseCount: 10,
        totalPagelas: 10,
      }),
    ).toBe(100);
  });

  it('só presença pontua o peso da presença', () => {
    expect(
      engagementScore({
        presenceCount: 10,
        meditationCount: 0,
        verseCount: 0,
        totalPagelas: 10,
      }),
    ).toBeCloseTo(30, 10);
  });

  it('fixture exata com valores parciais', () => {
    // (4 * 0.3 + 3 * 0.35 + 2 * 0.35) / 8 * 100 = 2.95 / 8 * 100 = 36.875
    expect(
      engagementScore({
        presenceCount: 4,
        meditationCount: 3,
        verseCount: 2,
        totalPagelas: 8,
      }),
    ).toBeCloseTo(36.875, 10);
  });

  it('sem pagela no recorte o índice é 0', () => {
    expect(
      engagementScore({
        presenceCount: 0,
        meditationCount: 0,
        verseCount: 0,
        totalPagelas: 0,
      }),
    ).toBe(0);
  });
});

describe('clubPerformanceScore', () => {
  it('quatro taxas em 100 dão 100', () => {
    expect(
      clubPerformanceScore({
        presenceRate: 100,
        meditationRate: 100,
        activityRate: 100,
        decisionRate: 100,
      }),
    ).toBeCloseTo(100, 10);
  });

  it('fixture exata', () => {
    // 80*0.3 + 60*0.3 + 50*0.2 + 20*0.2 = 24 + 18 + 10 + 4 = 56
    expect(
      clubPerformanceScore({
        presenceRate: 80,
        meditationRate: 60,
        activityRate: 50,
        decisionRate: 20,
      }),
    ).toBeCloseTo(56, 10);
  });

  it('clubinho sem nada registrado pontua 0', () => {
    expect(
      clubPerformanceScore({
        presenceRate: 0,
        meditationRate: 0,
        activityRate: 0,
        decisionRate: 0,
      }),
    ).toBe(0);
  });
});

describe('consecutiveAcademicWeeks', () => {
  it('conta a sequência a partir da semana mais recente', () => {
    expect(consecutiveAcademicWeeks('2026-12,2026-11,2026-10')).toBe(3);
  });

  it('para na primeira semana que falta', () => {
    // A semana 10 não aparece: a sequência é só 12 e 11.
    expect(consecutiveAcademicWeeks('2026-12,2026-11,2026-9')).toBe(2);
  });

  it('uma semana só conta 1', () => {
    expect(consecutiveAcademicWeeks('2026-12')).toBe(1);
  });

  it('a virada de ano quebra a sequência', () => {
    // Sem saber quantas semanas teve 2025, encadear seria chute.
    expect(consecutiveAcademicWeeks('2026-1,2025-52')).toBe(1);
  });

  it('sem histórico vale 0', () => {
    expect(consecutiveAcademicWeeks(undefined)).toBe(0);
    expect(consecutiveAcademicWeeks('')).toBe(0);
  });

  it('ignora chave malformada em vez de contar NaN', () => {
    expect(consecutiveAcademicWeeks('lixo,mais-lixo')).toBe(0);
  });
});

describe('consecutiveAcademicWeeks ancorada na semana corrente', () => {
  const semana12 = { year: 2026, week: 12 };

  it('sequência que chega até a semana corrente conta inteira', () => {
    expect(
      consecutiveAcademicWeeks('2026-012,2026-011,2026-010', semana12),
    ).toBe(3);
  });

  it('a semana corrente pode ainda não ter acontecido: vale a anterior', () => {
    // Clubinho de sábado, consulta na terça: a última pagela é da semana 11.
    expect(consecutiveAcademicWeeks('2026-011,2026-010', semana12)).toBe(2);
  });

  it('sequência antiga não é sequência em curso', () => {
    // Veio cinco semanas seguidas em março e sumiu: em novembro é zero, e não
    // "5 semanas seguidas".
    expect(
      consecutiveAcademicWeeks('2026-005,2026-004,2026-003', {
        year: 2026,
        week: 37,
      }),
    ).toBe(0);
  });

  it('pagela lançada adiantado não entra na sequência', () => {
    expect(
      consecutiveAcademicWeeks('2026-014,2026-012,2026-011', semana12),
    ).toBe(2);
  });

  it('fora do período letivo não há sequência em curso', () => {
    expect(consecutiveAcademicWeeks('2026-012,2026-011', null)).toBe(0);
  });

  it('sequência de outro ano letivo não vale para o corrente', () => {
    expect(
      consecutiveAcademicWeeks('2025-042,2025-041', { year: 2026, week: 1 }),
    ).toBe(0);
  });
});

describe('presenceRate', () => {
  it('divide os presentes pelos esperados, não pelas pagelas', () => {
    // 6 presentes de 10 esperados: 60%, ainda que só 6 pagelas tenham sido
    // lançadas (o que daria 100% na conta antiga).
    expect(presenceRate(6, 10)).toBe(60);
  });

  it('sem ninguém esperado a taxa é 0', () => {
    expect(presenceRate(0, 0)).toBe(0);
    expect(presenceRate(3, 0)).toBe(0);
  });

  it('nunca passa de 100', () => {
    // Pagela lançada num feriado: presença sem esperado correspondente.
    expect(presenceRate(11, 10)).toBe(100);
  });

  it('sem conta de esperados cai na taxa por pagela', () => {
    expect(presenceRateOrPerPagela(6, 8, null)).toBe(75);
    expect(presenceRateOrPerPagela(6, 8, 10)).toBe(60);
    expect(presenceRateOrPerPagela(0, 0, null)).toBe(0);
  });
});

describe('averageOfMeasured', () => {
  it('deixa de fora quem não tem o que medir', () => {
    const clubes = [
      { taxa: 80, medido: true },
      { taxa: 60, medido: true },
      // Sem pagela e sem criança esperada: não é 0%, é sem taxa.
      { taxa: 0, medido: false },
    ];

    expect(
      averageOfMeasured(
        clubes,
        (c) => c.medido,
        (c) => c.taxa,
      ),
    ).toBe(70);
  });

  it('ninguém medido vale 0', () => {
    expect(
      averageOfMeasured(
        [{ taxa: 0, medido: false }],
        (c) => c.medido,
        (c) => c.taxa,
      ),
    ).toBe(0);
  });
});

describe('clubPerformance', () => {
  it('fixture exata', () => {
    // presença 40/50 = 80; meditação 24/40 = 60; atividade 5/10 = 50;
    // decisão 1/5 = 20 → 80*0,3 + 60*0,3 + 50*0,2 + 20*0,2 = 56
    const desempenho = clubPerformance({
      presenceCount: 40,
      expectedPresences: 50,
      meditationCount: 24,
      totalPagelas: 40,
      activeChildren: 5,
      expectedChildren: 10,
      childrenWithDecisions: 1,
    });

    expect(desempenho.presenceRate).toBe(80);
    expect(desempenho.meditationRate).toBe(60);
    expect(desempenho.activityRate).toBe(50);
    expect(desempenho.decisionRate).toBe(20);
    expect(desempenho.performanceScore).toBeCloseTo(56, 10);
    expect(desempenho.measured).toBe(true);
  });

  it('nenhuma taxa passa de 100, e o índice também não', () => {
    // Era o caso real: decisões da vida inteira contra as crianças ativas do
    // mês davam "300%" de decisão e índice acima de 100.
    const desempenho = clubPerformance({
      presenceCount: 12,
      expectedPresences: 10,
      meditationCount: 10,
      totalPagelas: 10,
      activeChildren: 4,
      expectedChildren: 2,
      childrenWithDecisions: 12,
    });

    expect(desempenho.presenceRate).toBe(100);
    expect(desempenho.activityRate).toBe(100);
    expect(desempenho.decisionRate).toBe(100);
    expect(desempenho.performanceScore).toBe(100);
  });

  it('clubinho esperado que não lançou pagela tem 0% e entra nas médias', () => {
    const desempenho = clubPerformance({
      presenceCount: 0,
      expectedPresences: 30,
      meditationCount: 0,
      totalPagelas: 0,
      activeChildren: 0,
      expectedChildren: 10,
      childrenWithDecisions: 0,
    });

    expect(desempenho.presenceRate).toBe(0);
    expect(desempenho.measured).toBe(true);
  });

  it('sem esperado e sem pagela não há o que medir', () => {
    const desempenho = clubPerformance({
      presenceCount: 0,
      expectedPresences: 0,
      meditationCount: 0,
      totalPagelas: 0,
      activeChildren: 0,
      expectedChildren: 0,
      childrenWithDecisions: 0,
    });

    expect(desempenho.performanceScore).toBe(0);
    expect(desempenho.measured).toBe(false);
  });
});

describe('toCount', () => {
  it('lê o texto que a consulta raw devolve', () => {
    expect(toCount('42')).toBe(42);
    expect(toCount(42)).toBe(42);
  });

  it('ausência vale 0, e nunca NaN', () => {
    // `parseInt(null)` devolvia NaN e contaminava toda soma seguinte.
    expect(toCount(null)).toBe(0);
    expect(toCount(undefined)).toBe(0);
    expect(toCount('')).toBe(0);
    expect(toCount('abc')).toBe(0);
    expect(toCount(Number.NaN)).toBe(0);
  });
});

describe('ageInYears', () => {
  const hoje = new Date(2026, 8, 5);

  it('lê a data como dia de calendário, sem deslocar por fuso', () => {
    // `new Date('2016-09-06')` é meia-noite UTC, que em UTC-3 é dia 5 local:
    // a criança nascida no dia 6 ficava um ano mais velha na véspera.
    expect(ageInYears('2016-09-06', new Date(2026, 8, 5))).toBe(9);
    expect(ageInYears('2016-09-06', new Date(2026, 8, 6))).toBe(10);
  });

  it('conta anos completos', () => {
    expect(ageInYears('2016-09-05', hoje)).toBe(10);
  });

  it('quem ainda não fez aniversário tem um ano a menos', () => {
    expect(ageInYears('2016-09-06', hoje)).toBe(9);
    expect(ageInYears('2016-12-31', hoje)).toBe(9);
  });

  it('quem fez aniversário ontem já conta', () => {
    expect(ageInYears('2016-09-04', hoje)).toBe(10);
  });
});

describe('ageGroup', () => {
  it('classifica nas bordas de cada faixa', () => {
    expect(ageGroup(0)).toBe('0-5');
    expect(ageGroup(5)).toBe('0-5');
    expect(ageGroup(6)).toBe('6-10');
    expect(ageGroup(10)).toBe('6-10');
    expect(ageGroup(11)).toBe('11-15');
    expect(ageGroup(15)).toBe('11-15');
    expect(ageGroup(16)).toBe('16+');
    expect(ageGroup(40)).toBe('16+');
  });
});

describe('monthsParticipating', () => {
  const hoje = new Date(2026, 8, 5);

  it('conta meses de calendário', () => {
    expect(monthsParticipating('2026-06-05', hoje)).toBe(3);
    expect(monthsParticipating('2025-09-05', hoje)).toBe(12);
  });

  it('sem data de entrada vale 0', () => {
    expect(monthsParticipating(null, hoje)).toBe(0);
    expect(monthsParticipating(undefined, hoje)).toBe(0);
  });

  it('data futura não vira participação negativa', () => {
    // Digitação errada no cadastro não pode virar "-2 meses".
    expect(monthsParticipating('2026-11-05', hoje)).toBe(0);
  });
});

describe('participationTimeRange', () => {
  it('classifica nas bordas de cada faixa', () => {
    expect(participationTimeRange(0)).toBe('0-3 meses');
    expect(participationTimeRange(2)).toBe('0-3 meses');
    expect(participationTimeRange(3)).toBe('3-6 meses');
    expect(participationTimeRange(5)).toBe('3-6 meses');
    expect(participationTimeRange(6)).toBe('6-12 meses');
    expect(participationTimeRange(11)).toBe('6-12 meses');
    expect(participationTimeRange(12)).toBe('1+ ano');
  });
});
