import { UserRole } from 'src/core/auth/auth.types';

import { FeatureFlagAudience } from '../types';

/** Contrato de resposta de `/feature-flags`. */
export class FeatureFlagResponseDto {
  id: string;
  key: string;
  name: string;
  description: string | null;
  enabled: boolean;
  /** Perfis que enxergam a flag; vazio significa todos, inclusive visitantes. */
  targetRoles: UserRole[];
  /** O nome da combinação de `targetRoles`. */
  audience: FeatureFlagAudience;
  metadata: Record<string, unknown> | null;
  createdAt: string;
  updatedAt: string;
}
