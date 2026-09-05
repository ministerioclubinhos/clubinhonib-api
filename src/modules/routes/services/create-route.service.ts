import { Injectable, Logger } from '@nestjs/common';
import { EntityManager } from 'typeorm';

import { RouteRepository } from '../route-page.repository';
import { RouteEntity, RouteType } from '../route-page.entity';

/** Dados de uma rota nova. */
interface NovaRota {
  title: string;
  public?: boolean;
  subtitle: string;
  idToFetch: string;
  path?: string;
  entityType: string;
  description: string;
  entityId: string;
  type: RouteType;
  image?: string;
  prefix?: string;
  current?: boolean;
}

@Injectable()
export class CreateRouteService {
  private readonly logger = new Logger(CreateRouteService.name);

  constructor(private readonly routeRepo: RouteRepository) {}

  /**
   * Um `path` livre para o título informado.
   *
   * Quem cria uma página resolve o path antes de gravar; `excludeRouteId`
   * deixa uma rota existente manter o próprio path na edição.
   */
  async generateAvailablePath(
    baseName: string,
    prefix: string,
    excludeRouteId?: string,
  ): Promise<string> {
    const path = await this.routeRepo.findAvailablePath(
      baseName,
      prefix,
      excludeRouteId,
    );
    this.logger.debug(`Caminho disponível: ${path}`);

    return path;
  }

  /** Cria a rota fora de qualquer transação. */
  async createRoute(data: NovaRota): Promise<RouteEntity> {
    const path =
      data.path ??
      (await this.generateAvailablePath(data.title, data.prefix ?? ''));

    const route = new RouteEntity();
    Object.assign(route, {
      ...data,
      path,
      public: data.public ?? true,
      image: data.image || '',
    });

    const saved = await this.routeRepo.saveRoute(route);
    this.logger.debug(`Rota criada. ID=${saved.id}`);

    return saved;
  }

  /**
   * Cria a rota dentro da transação de quem chamou.
   *
   * É o caminho usado por toda página: a rota e a página precisam nascer
   * juntas, ou nenhuma das duas.
   */
  async createRouteWithManager(
    manager: EntityManager,
    data: Omit<NovaRota, 'prefix'> & { path: string },
  ): Promise<RouteEntity> {
    return this.routeRepo.createInTransaction(manager, {
      ...data,
      public: data.public ?? true,
      image: data.image || '',
    });
  }
}
