import { filterWeekClubs } from './utils';

const club = (status: string, weekday: string, severities: string[] = []) => ({
  status,
  weekday,
  indicators: severities.map((severity) => ({ severity })),
});

const CLUBS = [
  club('missing', 'saturday', ['critical']),
  club('partial', 'friday', ['warning']),
  club('ok', 'saturday'),
  club('pending', 'wednesday', ['info']),
  club('exception', 'saturday'),
];

describe('filterWeekClubs', () => {
  it('sem filtro devolve todos', () => {
    expect(filterWeekClubs(CLUBS, {})).toHaveLength(5);
  });

  it('filtra por status e por dia da semana', () => {
    expect(filterWeekClubs(CLUBS, { status: 'ok' })).toHaveLength(1);
    expect(filterWeekClubs(CLUBS, { weekday: 'saturday' })).toHaveLength(3);
    expect(
      filterWeekClubs(CLUBS, { weekday: 'saturday', status: 'missing' }),
    ).toHaveLength(1);
  });

  it('filtra pela severidade dos indicadores', () => {
    expect(filterWeekClubs(CLUBS, { severity: 'warning' })).toHaveLength(1);
    expect(filterWeekClubs(CLUBS, { severity: 'success' })).toHaveLength(0);
  });

  it('"com problemas" ignora o que está em dia, no prazo ou justificado', () => {
    const withProblems = filterWeekClubs(CLUBS, { hasProblems: true });
    expect(withProblems.map((c) => c.status)).toEqual(['missing', 'partial']);
    expect(
      filterWeekClubs(CLUBS, { hasProblems: false }).map((c) => c.status),
    ).toEqual(['ok']);
  });
});
