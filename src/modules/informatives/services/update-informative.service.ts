import { Injectable, Logger } from '@nestjs/common';
import { EntityManager } from 'typeorm';

import { CreateRouteService } from 'src/modules/routes/services/create-route.service';
import { UpdateRouteService } from 'src/modules/routes/services/update-route.service';
import { RouteEntity, RouteType } from 'src/modules/routes/route-page.entity';
import { MediaTargetType } from 'src/shared/media/media-target-type.enum';

import { INFORMATIVE_ROUTE_PREFIX } from '../constants';
import { UpdateInformativeDto } from '../dto/update-informative.dto';
import { InformativeResponseDto } from '../dto/informative-response.dto';
import { InformativeEntity } from '../entities/informative.entity';
import { InformativesRepository } from '../repositories/informatives.repository';
import { toInformativeResponse } from '../mappers';
import { GetInformativeService } from './get-informative.service';

@Injectable()
export class UpdateInformativeService {
  private readonly logger = new Logger(UpdateInformativeService.name);

  constructor(
    private readonly informativesRepo: InformativesRepository,
    private readonly getService: GetInformativeService,
    private readonly createRouteService: CreateRouteService,
    private readonly updateRouteService: UpdateRouteService,
  ) {}

  async execute(
    id: string,
    dto: UpdateInformativeDto,
  ): Promise<InformativeResponseDto> {
    this.logger.log(`🛠️ Atualizando banner informativo ID=${id}`);

    const existing = await this.getService.findEntityOrFail(id);

    // A transação é aberta pelo repositório; aqui só se decide o que entra
    // nela.
    const saved = await this.informativesRepo.runInTransaction(
      async (manager) => {
        const informative = await this.informativesRepo.updateInTransaction(
          manager,
          existing,
          {
            title: dto.title,
            description: dto.description,
            public: dto.public,
          },
        );

        informative.route = informative.route
          ? await this.updateRoute(informative.route.id, dto, informative.id)
          : await this.createRoute(manager, informative, dto);

        // A rota nova precisa ficar gravada no informativo; sem isto o banner
        // continuaria sem endereço público depois do save.
        await this.informativesRepo.saveInTransaction(manager, informative);

        return informative;
      },
    );

    this.logger.log(`✅ Informativo atualizado: ${saved.id}`);
    return toInformativeResponse(saved);
  }

  private routeData(
    dto: UpdateInformativeDto,
    informativeId: string,
  ): Partial<RouteEntity> {
    return {
      title: dto.title,
      subtitle: dto.description,
      description: dto.description,
      idToFetch: informativeId,
      entityType: MediaTargetType.Informative,
      entityId: informativeId,
      public: dto.public,
      type: RouteType.OTHER,
      image: '',
    };
  }

  private async updateRoute(
    routeId: string,
    dto: UpdateInformativeDto,
    informativeId: string,
  ): Promise<RouteEntity> {
    // `path` é único: resolver um endereço livre evita o conflito quando dois
    // informativos passam a ter o mesmo título.
    const route = await this.updateRouteService.upsertRouteWithAvailablePath(
      routeId,
      this.routeData(dto, informativeId),
      INFORMATIVE_ROUTE_PREFIX,
    );

    this.logger.debug(`✅ Rota atualizada: ${route.id}, path: ${route.path}`);
    return route;
  }

  /** Informativos antigos podem não ter rota; a edição cria uma. */
  private async createRoute(
    manager: EntityManager,
    informative: InformativeEntity,
    dto: UpdateInformativeDto,
  ): Promise<RouteEntity> {
    const path = await this.createRouteService.generateAvailablePath(
      dto.title,
      INFORMATIVE_ROUTE_PREFIX,
    );

    return this.createRouteService.createRouteWithManager(manager, {
      title: dto.title,
      subtitle: dto.description,
      description: dto.description,
      idToFetch: informative.id,
      entityType: MediaTargetType.Informative,
      entityId: informative.id,
      public: dto.public,
      type: RouteType.OTHER,
      image: '',
      path,
    });
  }
}
