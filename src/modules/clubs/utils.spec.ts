import { UserRole } from 'src/core/auth/auth.types';
import { AppForbiddenException } from 'src/shared/exceptions';

import { ClubAccessContext } from './types';
import { assertCanTakeTeachers } from './utils';

/**
 * Vincular um professor a um clubinho o move do anterior. O formulário do
 * clubinho não pode virar a porta dos fundos para tirar um professor da turma
 * de outra coordenação — a mesma regra que vale em
 * `PATCH /teacher-profiles/:id/assign-club`.
 */
describe('assertCanTakeTeachers', () => {
  const admin: ClubAccessContext = { role: UserRole.ADMIN, userId: 'admin-1' };
  const coordinator: ClubAccessContext = {
    role: UserRole.COORDINATOR,
    userId: 'coord-1',
  };

  const accessibleClubIds = new Set(['club-meu', 'club-editado']);

  const run = (
    context: ClubAccessContext,
    currentClubIdByTeacher: Map<string, string | null>,
    targetClubId: string | null = 'club-editado',
  ): void =>
    assertCanTakeTeachers({
      context,
      targetClubId,
      currentClubIdByTeacher,
      accessibleClubIds,
    });

  it('não barra o administrador', () => {
    expect(() => run(admin, new Map([['t-1', 'club-alheio']]))).not.toThrow();
  });

  it('deixa o coordenador trazer quem não tem turma', () => {
    expect(() => run(coordinator, new Map([['t-1', null]]))).not.toThrow();
  });

  it('deixa o coordenador mover entre clubinhos que ele coordena', () => {
    expect(() =>
      run(coordinator, new Map([['t-1', 'club-meu']])),
    ).not.toThrow();
  });

  it('não conta como movimento quem já está no clubinho editado', () => {
    expect(() =>
      run(coordinator, new Map([['t-1', 'club-editado']])),
    ).not.toThrow();
  });

  it('barra o coordenador que puxa de outra coordenação', () => {
    expect(() => run(coordinator, new Map([['t-1', 'club-alheio']]))).toThrow(
      AppForbiddenException,
    );
  });

  it('barra mesmo quando só um dos professores vem de fora', () => {
    expect(() =>
      run(
        coordinator,
        new Map([
          ['t-1', 'club-meu'],
          ['t-2', 'club-alheio'],
        ]),
      ),
    ).toThrow(AppForbiddenException);
  });

  /** Na criação não há clubinho de destino: qualquer vínculo atual é mudança. */
  it('na criação, qualquer vínculo fora do alcance barra', () => {
    expect(() =>
      run(coordinator, new Map([['t-1', 'club-alheio']]), null),
    ).toThrow(AppForbiddenException);
  });
});
