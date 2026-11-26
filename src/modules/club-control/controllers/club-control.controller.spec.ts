import { GUARDS_METADATA, PATH_METADATA } from '@nestjs/common/constants';

import { JwtAuthGuard } from 'src/core/auth/guards/jwt-auth.guard';
import {
  AdminOrLeaderRoleGuard,
  AdminRoleGuard,
} from 'src/core/auth/guards/role-guard';

import { ClubControlController } from './club-control.controller';

/**
 * Quem pode mexer no ano letivo e nas exceções.
 *
 * Só administrador. Não é preferência de tela: o período letivo define em que
 * dias **todo** clubinho se reúne, e uma exceção apaga uma data do calendário
 * de todos eles de uma vez — em alguns casos, de todos os anos seguintes.
 * Nenhum desses dois é decisão de um coordenador sobre o próprio clubinho.
 *
 * O teste lê a metadata do Nest em vez de subir a aplicação porque é o guarda
 * declarado que importa: trocar `AdminRoleGuard` por `AdminOrLeaderRoleGuard`,
 * ou mover o guarda da classe para os métodos e esquecer uma rota, abriria a
 * escrita para coordenador sem quebrar nenhum outro teste.
 */
describe('ClubControlController — acesso', () => {
  const guardsOf = (target: object): unknown[] =>
    (Reflect.getMetadata(GUARDS_METADATA, target) as unknown[]) ?? [];

  it('exige autenticação e papel de administrador no controller inteiro', () => {
    const guards = guardsOf(ClubControlController);

    expect(guards).toContain(JwtAuthGuard);
    expect(guards).toContain(AdminRoleGuard);
  });

  it('não admite o guarda que também aceita coordenador', () => {
    expect(guardsOf(ClubControlController)).not.toContain(
      AdminOrLeaderRoleGuard,
    );
  });

  /**
   * As sete rotas de escrita do ano letivo e das exceções. Se alguma delas
   * declarar um guarda próprio, ele substitui o da classe naquele método — e a
   * rota deixa de ser exclusiva de administrador sem que nada mais mude.
   */
  it.each([
    ['createPeriod'],
    ['updatePeriod'],
    ['deletePeriod'],
    ['createException'],
    ['updateException'],
    ['deleteException'],
  ])('a rota %s não relaxa o guarda da classe', (method) => {
    const handler = (
      ClubControlController.prototype as unknown as Record<string, object>
    )[method];

    expect(handler).toBeDefined();

    const guards = guardsOf(handler);
    const relaxa =
      guards.length > 0 &&
      (!guards.includes(AdminRoleGuard) ||
        guards.includes(AdminOrLeaderRoleGuard));

    expect(relaxa).toBe(false);
  });

  it('as rotas de escrita continuam existindo com os caminhos esperados', () => {
    // Se uma rota for renomeada, o teste acima passaria a olhar para um método
    // que não existe mais. Este prende os caminhos.
    const pathOf = (method: string): unknown =>
      Reflect.getMetadata(
        PATH_METADATA,
        (ClubControlController.prototype as unknown as Record<string, object>)[
          method
        ],
      );

    expect(pathOf('createPeriod')).toBe('periods');
    expect(pathOf('updatePeriod')).toBe('periods/:id');
    expect(pathOf('deletePeriod')).toBe('periods/:id');
    expect(pathOf('createException')).toBe('exceptions');
    expect(pathOf('updateException')).toBe('exceptions/:id');
    expect(pathOf('deleteException')).toBe('exceptions/:id');
  });
});
