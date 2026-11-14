import { Injectable, Logger } from '@nestjs/common';

import { RouteRepository } from '../route-page.repository';

@Injectable()
export class DeleteRouteService {
  private readonly logger = new Logger(DeleteRouteService.name);

  constructor(private readonly routeRepo: RouteRepository) {}

  /**
   * Remove a rota pelo id.
   *
   * Rota inexistente não é erro: quem apaga uma página quer que a rota deixe
   * de existir, e ela já não existe.
   */
  async removeRoute(id: string): Promise<void> {
    const route = await this.routeRepo.findById(id);

    if (!route) {
      this.logger.warn(`Tentativa de remover rota inexistente. ID=${id}`);
      return;
    }

    await this.routeRepo.removeRoute(route);
    this.logger.debug(`Rota removida. ID=${id}`);
  }

  /** Remove a rota de uma entidade; a ausência também não é erro. */
  async removeRouteByEntity(
    entityType: string,
    entityId: string,
  ): Promise<void> {
    const route = await this.routeRepo.findByEntity(entityType, entityId);

    if (!route) {
      this.logger.warn(`Nenhuma rota para ${entityType} ID=${entityId}`);
      return;
    }

    await this.routeRepo.removeRoute(route);
    this.logger.log(`Rota removida. ID=${route.id}`);
  }
}
