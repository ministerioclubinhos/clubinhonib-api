import { Injectable, Logger } from '@nestjs/common';

import { GetMeditationService } from 'src/modules/meditations/services/get-meditation.service';

import { RouteRepository } from '../route-page.repository';
import { RouteEntity } from '../route-page.entity';

@Injectable()
export class GetRouteService {
  private readonly logger = new Logger(GetRouteService.name);

  constructor(
    private readonly routeRepo: RouteRepository,
    private readonly getMeditationService: GetMeditationService,
  ) {}

  /**
   * Todas as rotas, mais os dias da meditação da semana.
   *
   * Os dias não têm linha na tabela: são derivados da meditação vigente e
   * entram na lista para o site montar a navegação sem uma segunda chamada.
   */
  async findAllRoutes(): Promise<RouteEntity[]> {
    const meditation = await this.getMeditationService.getThisWeekMeditation();
    const routes = await this.routeRepo.findAllRoutes();

    if (!meditation) return routes;

    const diasDaMeditacao = meditation.days.map(
      (day) =>
        ({
          id: day.id,
          title: day.topic,
          subtitle: day.verse,
          description: day.verse,
          path: day.day,
          public: false,
          current: false,
          image: meditation.media?.url,
          idToFetch: meditation.id,
          entityType: 'MeditationDay',
          entityId: meditation.id,
          type: 'page',
          createdAt: new Date(),
          updatedAt: new Date(),
        }) as RouteEntity,
    );

    return [...routes, ...diasDaMeditacao];
  }

  async findById(id: string): Promise<RouteEntity | null> {
    return this.routeRepo.findById(id);
  }

  /** A rota de uma entidade, ou `null` quando ela não tem rota. */
  async findRouteByEntityId(entityId: string): Promise<RouteEntity | null> {
    const route = await this.routeRepo.findByEntityId(entityId);

    if (!route) {
      this.logger.warn(`Nenhuma rota para entityId=${entityId}`);
    }

    return route;
  }
}
