import { ChildEntity } from 'src/modules/children/entities/child.entity';

import { ClubExceptionEntity } from '../entities/club-exception.entity';
import { ClubIndicatorsService } from './club-indicators.service';

const crianca = (id: string, ativa = false): ChildEntity =>
  Object.assign(new ChildEntity(), {
    id,
    name: `Criança ${id}`,
    isActive: ativa,
  });

const excecao = Object.assign(new ClubExceptionEntity(), {
  exceptionDate: '2026-04-03',
  reason: 'Sexta-feira Santa',
  type: 'holiday',
  isRecurrent: true,
  isActive: true,
});

describe('ClubIndicatorsService.generateIndicators', () => {
  const service = new ClubIndicatorsService();

  const gerar = (args: {
    status: string;
    hasException?: boolean;
    hasPassedClubDay?: boolean;
    total?: number;
    withPagela?: number;
    missing?: number;
    inativas?: ChildEntity[];
    completionRate?: number;
    missingRate?: number;
  }) =>
    service.generateIndicators(
      args.status,
      args.hasException ?? false,
      args.hasException ? excecao : null,
      args.hasPassedClubDay ?? true,
      args.total ?? 0,
      args.withPagela ?? 0,
      args.missing ?? 0,
      args.inativas ?? [],
      args.completionRate ?? 0,
      args.missingRate ?? 0,
    );

  it('crianças desativadas viram um indicador próprio', () => {
    const indicadores = gerar({
      status: 'ok',
      total: 8,
      withPagela: 8,
      inativas: [crianca('a'), crianca('b')],
      completionRate: 100,
    });

    const naoFrequentam = indicadores.find(
      (i) => i.type === 'children_not_attending',
    );

    expect(naoFrequentam?.severity).toBe('warning');
    expect(naoFrequentam?.details?.totalChildren).toBe(2);
    expect(naoFrequentam?.details?.childrenList).toHaveLength(2);
  });

  it('exceção encerra a análise: nenhum indicador de falta é emitido', () => {
    // Feriado não gera cobrança, mesmo sem nenhuma pagela e com o dia passado.
    const indicadores = gerar({
      status: 'exception',
      hasException: true,
      total: 10,
      withPagela: 0,
      missing: 10,
      missingRate: 100,
    });

    expect(indicadores.map((i) => i.type)).toEqual(['exception']);
    expect(indicadores[0].details?.reason).toBe('Sexta-feira Santa');
  });

  it('tudo em dia gera um indicador de sucesso', () => {
    const indicadores = gerar({
      status: 'ok',
      total: 10,
      withPagela: 10,
      completionRate: 100,
    });

    expect(indicadores[0]).toMatchObject({
      type: 'all_ok',
      severity: 'success',
    });
    expect(indicadores[0].details?.isPerfect).toBe(true);
  });

  it('clubinho sem criança não gera indicador de sucesso', () => {
    // `status: 'ok'` com zero criança é ausência de cobrança, não sucesso.
    expect(gerar({ status: 'ok', total: 0, withPagela: 0 })).toEqual([]);
  });

  it('a urgência do parcial acompanha o quanto está faltando', () => {
    const urgencia = (missingRate: number) =>
      gerar({
        status: 'partial',
        total: 10,
        withPagela: 10 - missingRate / 10,
        missing: missingRate / 10,
        missingRate,
      })[0].details?.urgency;

    expect(urgencia(60)).toBe('high');
    expect(urgencia(40)).toBe('medium');
    expect(urgencia(20)).toBe('low');
  });

  it('nada é cobrado antes de o dia do clubinho passar', () => {
    // Sem isso, um clubinho de sábado apareceria em vermelho na segunda.
    expect(
      gerar({
        status: 'partial',
        hasPassedClubDay: false,
        total: 10,
        withPagela: 4,
        missing: 6,
        missingRate: 60,
      }),
    ).toEqual([]);
    expect(
      gerar({
        status: 'missing',
        hasPassedClubDay: false,
        total: 10,
        missing: 10,
      }),
    ).toEqual([]);
  });

  it('nenhuma pagela com crianças esperadas é crítico', () => {
    const indicadores = gerar({
      status: 'missing',
      total: 10,
      withPagela: 0,
      missing: 10,
      missingRate: 100,
    });

    expect(indicadores[0]).toMatchObject({
      type: 'no_pagela',
      severity: 'critical',
    });
    expect(indicadores[0].details?.urgency).toBe('critical');
  });

  it('nenhuma pagela sem criança nenhuma é aviso de cadastro, não falta', () => {
    const indicadores = gerar({ status: 'missing', total: 0 });

    expect(indicadores[0]).toMatchObject({
      type: 'no_children',
      severity: 'warning',
    });
    expect(indicadores[0].details?.needsAttention).toBe(false);
  });
});

describe('ClubIndicatorsService.generateInactiveClubIndicators', () => {
  const service = new ClubIndicatorsService();

  it('marca o clubinho como desativado e lista quem não frequenta', () => {
    const indicadores = service.generateInactiveClubIndicators(
      [crianca('a', true), crianca('b')],
      [crianca('a', true), crianca('b')],
    );

    expect(indicadores.map((i) => i.type)).toEqual([
      'club_inactive',
      'children_not_attending',
    ]);
    // Num clubinho desativado, todas as crianças contam como não frequentando
    // — inclusive as que continuam ativas no cadastro.
    expect(indicadores[1].details?.childrenList).toHaveLength(2);
  });
});
