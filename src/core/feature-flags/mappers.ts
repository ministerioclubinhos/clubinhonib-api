import { FeatureFlagEntity } from './entities/feature-flag.entity';
import { FeatureFlagResponseDto } from './dto/feature-flag-response.dto';
import { audienceOfRoles, targetRolesOf } from './utils';

/** Carimbo de data em ISO, venha ele como `Date` ou já como texto. */
function toIsoString(value: Date | string): string {
  return value instanceof Date ? value.toISOString() : String(value);
}

/**
 * Contrato de resposta de `/feature-flags`.
 *
 * `audience` acompanha `targetRoles` para que as duas pontas nomeiem a mesma
 * combinação sem cada uma deduzir a sua.
 */
export function toFeatureFlagResponse(
  flag: FeatureFlagEntity,
): FeatureFlagResponseDto {
  const targetRoles = targetRolesOf(flag);

  return {
    id: flag.id,
    key: flag.key,
    name: flag.name,
    description: flag.description ?? null,
    enabled: flag.enabled,
    targetRoles,
    audience: audienceOfRoles(targetRoles),
    metadata: flag.metadata ?? null,
    createdAt: toIsoString(flag.createdAt),
    updatedAt: toIsoString(flag.updatedAt),
  };
}

/** A mesma conversão, para uma lista. */
export function toFeatureFlagResponseList(
  flags: FeatureFlagEntity[],
): FeatureFlagResponseDto[] {
  return flags.map(toFeatureFlagResponse);
}
