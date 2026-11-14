import { InformativeEntity } from './entities/informative.entity';
import { InformativeResponseDto } from './dto/informative-response.dto';

/** Carimbo de data em ISO, venha ele como `Date` ou já como texto. */
function toIsoString(value: Date | string): string {
  return value instanceof Date ? value.toISOString() : String(value);
}

/** Contrato de resposta de `/informatives`. */
export function toInformativeResponse(
  informative: InformativeEntity,
): InformativeResponseDto {
  return {
    id: informative.id,
    title: informative.title,
    description: informative.description,
    public: informative.public,
    // A rota é o endereço público do informativo; `null` quando não tem.
    routePath: informative.route?.path ?? null,
    createdAt: toIsoString(informative.createdAt),
    updatedAt: toIsoString(informative.updatedAt),
  };
}
