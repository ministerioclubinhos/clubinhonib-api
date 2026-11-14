import { RouteType } from '../route-page.entity';

/**
 * Contrato de resposta de `/routes`.
 *
 * A rota é pública: o site monta o mapa de navegação antes de qualquer login.
 * Por isso o conjunto de campos é declarado aqui em vez de sair da entidade —
 * uma coluna nova no banco não vaza sozinha para quem não está autenticado.
 */
export class RouteResponseDto {
  id: string;
  title: string;
  subtitle: string;
  description: string;
  path: string;
  /** `false` quando a rota ainda não foi liberada para o site. */
  public: boolean;
  /** Marca a rota em destaque; ausente no banco significa `false`. */
  current: boolean;
  /** `null` quando a rota não tem imagem de capa. */
  image: string | null;
  idToFetch: string;
  entityId: string;
  entityType: string;
  type: RouteType;
  createdAt: string;
  updatedAt: string;
}
