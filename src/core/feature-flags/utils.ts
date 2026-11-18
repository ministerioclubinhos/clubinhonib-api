import { UserRole } from 'src/core/auth/auth.types';

import { FeatureFlagEntity } from './entities/feature-flag.entity';
import {
  FEATURE_FLAG_AUDIENCE_ROLES,
  FEATURE_FLAG_ROLE_ORDER,
  FeatureFlagAudience,
} from './types';

/** Os perfis válidos, para reconhecer o que vem gravado no banco. */
const VALID_ROLES = new Set<string>(Object.values(UserRole));

/**
 * Perfis alvo de uma flag, normalizados.
 *
 * O que está gravado é texto livre — registros antigos trazem espaços, caixa
 * trocada e repetições. A lista sai sem duplicatas, só com perfis conhecidos e
 * sempre na mesma ordem, que é o que permite comparar combinações.
 */
export function normalizeTargetRoles(roles?: string[] | null): UserRole[] {
  if (!roles || roles.length === 0) return [];

  const normalized = new Set<UserRole>();

  for (const role of roles) {
    const candidate = String(role).toLowerCase().trim();
    if (VALID_ROLES.has(candidate)) {
      normalized.add(candidate as UserRole);
    }
  }

  return FEATURE_FLAG_ROLE_ORDER.filter((role) => normalized.has(role));
}

/**
 * Perfis alvo de uma flag, considerando onde eles podem estar guardados.
 *
 * Antes da coluna `target_roles` a lista vivia dentro de `metadata`; flags
 * antigas ainda estão assim.
 */
export function targetRolesOf(flag: FeatureFlagEntity): UserRole[] {
  if (flag.targetRoles?.length) return normalizeTargetRoles(flag.targetRoles);

  const fromMetadata: unknown = flag.metadata?.targetRoles;
  if (Array.isArray(fromMetadata)) {
    return normalizeTargetRoles(fromMetadata.map((role) => String(role)));
  }

  return [];
}

/** A combinação correspondente aos perfis informados. */
export function audienceOfRoles(roles: UserRole[]): FeatureFlagAudience {
  const normalized = normalizeTargetRoles(roles);
  const signature = normalized.join(',');

  const match = (
    Object.keys(FEATURE_FLAG_AUDIENCE_ROLES) as FeatureFlagAudience[]
  ).find(
    (audience) => FEATURE_FLAG_AUDIENCE_ROLES[audience].join(',') === signature,
  );

  // Toda combinação de um a três perfis está mapeada; o `EVERYONE` cobre a
  // lista vazia, que é o resto possível.
  return match ?? 'EVERYONE';
}

/** Os perfis de uma combinação. */
export function rolesOfAudience(audience: FeatureFlagAudience): UserRole[] {
  return [...FEATURE_FLAG_AUDIENCE_ROLES[audience]];
}

/**
 * Decide se a flag vale para quem está pedindo.
 *
 * Uma flag desligada não vale para ninguém. Sem perfis alvo ela vale para
 * todos, inclusive para quem não fez login. Com perfis alvo, ela exige uma
 * sessão cujo perfil esteja na lista.
 */
export function isTargetedForRole(
  flag: FeatureFlagEntity,
  role?: UserRole | string | null,
): boolean {
  if (!flag.enabled) return false;

  const targetRoles = targetRolesOf(flag);
  if (targetRoles.length === 0) return true;

  if (!role) return false;

  const normalized = String(role).toLowerCase().trim();
  return targetRoles.some((target) => String(target) === normalized);
}
