import { AppForbiddenException, ErrorCode } from 'src/shared/exceptions';
import { CLUB_DISTRICT_FALLBACK, CLUB_MANAGER_ROLES } from './constants';
import { ClubAccessContext } from './types';

/** Papel em minúsculas, que é como as regras comparam. */
export function normalizedRole(context: ClubAccessContext): string {
  return context.role?.toLowerCase() ?? '';
}

/** Só administrador e coordenador administram clubinhos. */
export function canManageClubs(context: ClubAccessContext): boolean {
  return (CLUB_MANAGER_ROLES as readonly string[]).includes(
    normalizedRole(context),
  );
}

/**
 * Barra quem não pode administrar clubinhos.
 *
 * A regra estava repetida em cada caso de uso, com mensagens diferentes; aqui
 * ela existe uma vez só.
 */
export function assertCanManageClubs(context: ClubAccessContext): void {
  if (!canManageClubs(context)) {
    throw new AppForbiddenException(
      ErrorCode.CLUB_ACCESS_DENIED,
      'Acesso negado',
    );
  }
}

/** Horário em `HH:mm`, ou `null` quando não há. */
export function toDisplayTime(value?: string | null): string | null {
  return typeof value === 'string' ? value.slice(0, 5) : null;
}

/** Rótulo do clubinho nos seletores: `Clubinho 12 : Centro`. */
export function formatClubOptionLabel(
  number: number,
  district?: string | null,
): string {
  return `Clubinho ${number} : ${district?.trim() || CLUB_DISTRICT_FALLBACK}`;
}

/**
 * Um coordenador só traz para o clubinho dele um professor que já esteja sob a
 * sua coordenação.
 *
 * Vincular passou a mover o professor entre clubinhos; sem esta conferência, o
 * formulário do clubinho seria a porta dos fundos para tirar um professor da
 * turma de outra coordenação.
 */
export function assertCanTakeTeachers(args: {
  context: ClubAccessContext;
  targetClubId: string | null;
  currentClubIdByTeacher: Map<string, string | null>;
  accessibleClubIds: Set<string>;
}): void {
  const { context, targetClubId, currentClubIdByTeacher, accessibleClubIds } =
    args;

  if (normalizedRole(context) !== 'coordinator') return;

  for (const [, currentClubId] of currentClubIdByTeacher) {
    if (!currentClubId || currentClubId === targetClubId) continue;
    if (accessibleClubIds.has(currentClubId)) continue;

    throw new AppForbiddenException(
      ErrorCode.CLUB_ACCESS_DENIED,
      'Um dos professores está em um clubinho de outra coordenação',
    );
  }
}
