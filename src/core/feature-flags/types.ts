import { UserRole } from 'src/core/auth/auth.types';

import { FEATURE_FLAG_AUDIENCES, FEATURE_FLAG_SORT_FIELDS } from './constants';

/** Campo pelo qual a listagem pode ser ordenada. */
export type FeatureFlagSortField = (typeof FEATURE_FLAG_SORT_FIELDS)[number];

/** Direção da ordenação. */
export type FeatureFlagSortOrder = 'ASC' | 'DESC';

/** Combinação de perfis que enxerga a flag. */
export type FeatureFlagAudience = (typeof FEATURE_FLAG_AUDIENCES)[number];

/**
 * Perfis de cada combinação.
 *
 * `EVERYONE` é a lista vazia: sem perfil alvo, a flag não filtra ninguém.
 */
export const FEATURE_FLAG_AUDIENCE_ROLES: Record<
  FeatureFlagAudience,
  UserRole[]
> = {
  EVERYONE: [],
  ADMIN: [UserRole.ADMIN],
  COORDINATOR: [UserRole.COORDINATOR],
  TEACHER: [UserRole.TEACHER],
  ADMIN_COORDINATOR: [UserRole.ADMIN, UserRole.COORDINATOR],
  ADMIN_TEACHER: [UserRole.ADMIN, UserRole.TEACHER],
  COORDINATOR_TEACHER: [UserRole.COORDINATOR, UserRole.TEACHER],
  ALL_ROLES: [UserRole.ADMIN, UserRole.COORDINATOR, UserRole.TEACHER],
};

/** Ordem canônica dos perfis, usada para comparar combinações. */
export const FEATURE_FLAG_ROLE_ORDER: UserRole[] = [
  UserRole.ADMIN,
  UserRole.COORDINATOR,
  UserRole.TEACHER,
];
