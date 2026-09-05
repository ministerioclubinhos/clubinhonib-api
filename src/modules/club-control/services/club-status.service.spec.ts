import { ClubStatusService } from './club-status.service';

/**
 * A situação de um clubinho na semana.
 *
 * É o que decide se falta pagela ou não, e o que a tela pinta de vermelho. Os
 * casos abaixo cobrem as bordas: exceção de calendário, semana futura, dia do
 * clubinho ainda não chegou, e clubinho sem criança nenhuma.
 */
describe('ClubStatusService.determineStatus', () => {
  const service = new ClubStatusService();

  const situacao = (args: {
    hasException?: boolean;
    isFutureWeek?: boolean;
    hasPassedClubDay?: boolean;
    isCurrentWeek?: boolean;
    withPagela?: number;
    total?: number;
  }) =>
    service.determineStatus(
      args.hasException ?? false,
      args.isFutureWeek ?? false,
      args.hasPassedClubDay ?? true,
      args.isCurrentWeek ?? false,
      args.withPagela ?? 0,
      args.total ?? 0,
    );

  it('exceção de calendário ganha de tudo', () => {
    // Feriado ou recesso: não há pagela a cobrar, mesmo sem nenhuma
    // registrada e com o dia já passado.
    expect(situacao({ hasException: true, withPagela: 0, total: 10 })).toBe(
      'exception',
    );
  });

  it('semana futura sem pagela fica pendente, não faltando', () => {
    expect(situacao({ isFutureWeek: true, withPagela: 0, total: 10 })).toBe(
      'pending',
    );
  });

  it('semana futura já adiantada conta como parcial ou completa', () => {
    expect(situacao({ isFutureWeek: true, withPagela: 4, total: 10 })).toBe(
      'partial',
    );
    expect(situacao({ isFutureWeek: true, withPagela: 10, total: 10 })).toBe(
      'ok',
    );
  });

  it('na semana corrente, antes do dia do clubinho, é pendente', () => {
    // Um clubinho de sábado não pode aparecer devendo pagela na quarta.
    expect(
      situacao({
        isCurrentWeek: true,
        hasPassedClubDay: false,
        withPagela: 3,
        total: 10,
      }),
    ).toBe('pending');
  });

  it('na semana corrente, tudo registrado antes do dia já é ok', () => {
    expect(
      situacao({
        isCurrentWeek: true,
        hasPassedClubDay: false,
        withPagela: 10,
        total: 10,
      }),
    ).toBe('ok');
  });

  it('depois do dia, decide pela contagem', () => {
    expect(situacao({ withPagela: 10, total: 10 })).toBe('ok');
    expect(situacao({ withPagela: 4, total: 10 })).toBe('partial');
    expect(situacao({ withPagela: 0, total: 10 })).toBe('missing');
  });

  it('clubinho sem criança nenhuma conta como ok depois do dia', () => {
    // Zero de zero: não há pagela a cobrar. O indicador `no_children` é quem
    // sinaliza que o cadastro pode estar incompleto.
    expect(situacao({ withPagela: 0, total: 0 })).toBe('ok');
  });

  it('clubinho sem criança em semana futura fica pendente', () => {
    // Aqui a regra difere: sem criança, `0 === 0` não vale como ok porque a
    // semana ainda nem chegou.
    expect(situacao({ isFutureWeek: true, withPagela: 0, total: 0 })).toBe(
      'pending',
    );
  });
});
