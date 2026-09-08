import { AppForbiddenException, ErrorCode } from 'src/shared/exceptions';
import { UserRole } from 'src/core/auth/auth.types';

import {
  assertCanChangeChildClub,
  assertCanDeleteChild,
  assertCanUnlinkChildClub,
  toDateOnly,
  toIsoDateTime,
} from './utils';

/**
 * As colunas de nascimento e entrada são de data pura e voltam ora como `Date`,
 * ora como texto, conforme o driver. Antes cada serviço tinha a sua cópia desta
 * conversão.
 */
describe('toDateOnly', () => {
  it('mantém o dia de calendário de um texto já no formato', () => {
    expect(toDateOnly('2026-05-20')).toBe('2026-05-20');
  });

  it('corta o horário de um carimbo completo', () => {
    expect(toDateOnly('2026-05-20T23:30:00.000Z')).toBe('2026-05-20');
  });

  it('converte um Date', () => {
    expect(toDateOnly(new Date('1990-05-20T00:00:00Z'))).toBe('1990-05-20');
  });

  it('devolve nulo para ausente, vazio ou inválido', () => {
    expect(toDateOnly(null)).toBeNull();
    expect(toDateOnly(undefined)).toBeNull();
    expect(toDateOnly('nao-e-data')).toBeNull();
    expect(toDateOnly(new Date('invalida'))).toBeNull();
  });
});

describe('toIsoDateTime', () => {
  it('preserva um carimbo que já está em ISO', () => {
    expect(toIsoDateTime('2026-05-20T12:00:00.000Z')).toBe(
      '2026-05-20T12:00:00.000Z',
    );
  });

  it('converte um Date', () => {
    expect(toIsoDateTime(new Date('2026-05-20T12:00:00Z'))).toBe(
      '2026-05-20T12:00:00.000Z',
    );
  });
});

/**
 * Excluir criança é só do administrador.
 *
 * A rota não tinha guarda de papel nenhuma: quem enxergava a criança podia
 * apagá-la. E o recorte por papel entrega, além do próprio clubinho, todas as
 * crianças **sem clubinho** — então um professor conseguia excluir qualquer
 * criança ainda não vinculada.
 */
describe('assertCanDeleteChild', () => {
  const contexto = (role?: UserRole) => ({ role, userId: 'user-1' });

  it('deixa o administrador passar', () => {
    expect(() => assertCanDeleteChild(contexto(UserRole.ADMIN))).not.toThrow();
  });

  it.each([[UserRole.COORDINATOR], [UserRole.TEACHER]])(
    'recusa o papel %s',
    (role) => {
      expect(() => assertCanDeleteChild(contexto(role))).toThrow(
        AppForbiddenException,
      );
    },
  );

  it('recusa quem chega sem papel', () => {
    expect(() => assertCanDeleteChild(contexto(undefined))).toThrow(
      AppForbiddenException,
    );
  });

  it('devolve o código de acesso negado, com a alternativa na mensagem', () => {
    try {
      assertCanDeleteChild(contexto(UserRole.COORDINATOR));
      throw new Error('deveria ter lançado');
    } catch (error) {
      const falha = error as AppForbiddenException;
      expect(falha.code).toBe(ErrorCode.CHILD_ACCESS_DENIED);
      expect(falha.message).toContain('desative-a');
    }
  });
});

describe('assertCanChangeChildClub', () => {
  const contexto = (role?: UserRole) => ({ role, userId: 'user-1' });

  it('o professor não move a criança de clubinho', () => {
    expect(() => assertCanChangeChildClub(contexto(UserRole.TEACHER))).toThrow(
      AppForbiddenException,
    );
  });

  it.each([[UserRole.ADMIN], [UserRole.COORDINATOR]])(
    '%s pode mover; o destino é conferido depois',
    (role) => {
      expect(() => assertCanChangeChildClub(contexto(role))).not.toThrow();
    },
  );
});

/**
 * Desvincular era o caminho sem porteiro: mover para outro clubinho passava
 * pela conferência de escopo, mas `clubId: null` entrava direto.
 */
describe('assertCanUnlinkChildClub', () => {
  const contexto = (role?: UserRole) => ({ role, userId: 'user-1' });

  it('só o administrador deixa a criança sem clubinho', () => {
    expect(() =>
      assertCanUnlinkChildClub(contexto(UserRole.ADMIN)),
    ).not.toThrow();
  });

  it.each([[UserRole.COORDINATOR], [UserRole.TEACHER]])(
    'recusa o papel %s',
    (role) => {
      expect(() => assertCanUnlinkChildClub(contexto(role))).toThrow(
        AppForbiddenException,
      );
    },
  );

  it('a mensagem aponta a alternativa: escolher outro clubinho', () => {
    try {
      assertCanUnlinkChildClub(contexto(UserRole.COORDINATOR));
      throw new Error('deveria ter lançado');
    } catch (error) {
      expect((error as AppForbiddenException).message).toContain(
        'escolha o novo clubinho',
      );
    }
  });
});
