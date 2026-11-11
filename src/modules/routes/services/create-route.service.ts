import { Injectable, Logger } from '@nestjs/common';
import { EntityManager } from 'typeorm';

import { RouteRepository } from '../route-page.repository';
import { RouteEntity, RouteType } from '../route-page.entity';
import { ROUTE_PATH_INSERT_ATTEMPTS } from '../constants';
import { isDuplicateRouteError } from '../utils';

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

  /**
   * Cria a rota de uma página nova escolhendo um `path` livre e resistindo a
   * colisões na gravação.
   *
   * O desempate é sempre o sufixo numérico sequencial sobre a mesma base:
   * `base`, `base_1`, `base_2`… Conferir a disponibilidade e gravar são dois
   * passos: outra criação com a mesma base pode ocupar o `path` entre um e
   * outro. Quando o banco recusa a gravação por unicidade, só a tentativa é
   * desfeita (savepoint) e o próximo sufixo livre é consultado de novo. A
   * consulta roda fora da transação de quem chamou de propósito: cada leitura
   * enxerga as rotas já confirmadas por outras transações, inclusive a que
   * acabou de vencer a disputa. Esgotadas as tentativas, o erro sobe e quem
   * chamou desfaz a própria transação — nada fica para trás.
   *
   * `pathSource` é o texto de onde a base do `path` sai; sem ele, é o título.
   */
  async createRouteWithAvailablePath(
    manager: EntityManager,
    data: Omit<NovaRota, 'prefix' | 'path'>,
    prefix: string,
    pathSource?: string,
  ): Promise<RouteEntity> {
    const source = pathSource?.trim() || data.title;
    for (let attempt = 1; ; attempt += 1) {
      const path = await this.generateAvailablePath(source, prefix);
      try {
        return await this.routeRepo.createInSavepoint(manager, {
          ...data,
          path,
          public: data.public ?? true,
          image: data.image || '',
        });
      } catch (error: unknown) {
        if (
          attempt >= ROUTE_PATH_INSERT_ATTEMPTS ||
          !isDuplicateRouteError(error)
        )
          throw error;
        this.logger.warn(
          `Caminho ${path} ocupado durante a gravação; nova tentativa (${attempt}/${ROUTE_PATH_INSERT_ATTEMPTS}).`,
        );
      }
    }
  }
}
