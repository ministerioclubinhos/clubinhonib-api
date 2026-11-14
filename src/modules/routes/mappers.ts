import { RouteEntity } from './route-page.entity';
import { RouteResponseDto } from './dto/route-response.dto';

/** Carimbo de data em ISO, venha ele como `Date` ou já como texto. */
function toIsoString(value: Date | string): string {
  return value instanceof Date ? value.toISOString() : String(value);
}

/** Uma rota no contrato público. */
export function toRouteResponse(route: RouteEntity): RouteResponseDto {
  return {
    id: route.id,
    title: route.title,
    subtitle: route.subtitle,
    description: route.description,
    path: route.path,
    public: route.public,
    // A coluna aceita nulo; o site espera sempre um booleano.
    current: route.current ?? false,
    image: route.image ?? null,
    idToFetch: route.idToFetch,
    entityId: route.entityId,
    entityType: route.entityType,
    type: route.type,
    createdAt: toIsoString(route.createdAt),
    updatedAt: toIsoString(route.updatedAt),
  };
}

/** A lista de rotas no contrato público. */
export function toRouteResponseList(routes: RouteEntity[]): RouteResponseDto[] {
  return routes.map(toRouteResponse);
}
