import { Injectable, Logger } from '@nestjs/common';
import { EntityManager } from 'typeorm';

import {
  AppConflictException,
  AppNotFoundException,
  ErrorCode,
} from 'src/shared/exceptions';

import { RouteRepository } from '../route-page.repository';
import { RouteEntity } from '../route-page.entity';

@Injectable()
export class UpdateRouteService {
  private readonly logger = new Logger(UpdateRouteService.name);

  constructor(private readonly routeRepo: RouteRepository) {}

  /** Edita os campos de texto de uma rota, recusando `path` já em uso. */
  async updateRoute(
    id: string,
    updateData: Partial<
      Pick<RouteEntity, 'title' | 'description' | 'path' | 'subtitle'>
    >,
  ): Promise<RouteEntity> {
    const route = await this.routeRepo.findById(id);

    if (!route) {
      throw new AppNotFoundException(
        ErrorCode.ROUTE_NOT_FOUND,
        'Rota não encontrada',
      );
    }

    if (updateData.path) {
      const existente = await this.routeRepo.findByPath(updateData.path);

      if (existente && existente.id !== id) {
        throw new AppConflictException(
          ErrorCode.RESOURCE_CONFLICT,
          `A rota "${updateData.path}" já está em uso`,
        );
      }
    }

    Object.assign(route, updateData);
    const updated = await this.routeRepo.saveRoute(route);
    this.logger.debug(`Rota atualizada. ID=${updated.id}`);

    return updated;
  }

  /**
   * Grava a rota resolvendo um `path` livre a partir do título.
   *
   * A versão que existia antes gerava o path sem conferir disponibilidade, e
   * quebrava a edição assim que duas páginas passavam a ter o mesmo título —
   * `path` é único no banco.
   */
  async upsertRouteWithAvailablePath(
    routeId: string,
    updateData: Partial<RouteEntity>,
    prefix: string,
    manager?: EntityManager,
  ): Promise<RouteEntity> {
    const path = await this.routeRepo.findAvailablePath(
      updateData.title || '',
      prefix,
      routeId,
    );
    this.logger.debug(`Upsert da rota ID=${routeId} com path="${path}"`);

    return this.routeRepo.upsertRoute(
      routeId,
      { ...updateData, path },
      manager,
    );
  }
}
