import { Injectable, Logger } from '@nestjs/common';
import {
  AppException,
  AppInternalException,
  ErrorCode,
} from 'src/shared/exceptions';
import { EntityManager } from 'typeorm';
import { CreateRouteService } from 'src/modules/routes/services/create-route.service';
import { RouteType } from 'src/modules/routes/route-page.entity';
import { CreateInformativeDto } from '../dto/create-informative.dto';
import { InformativesRepository } from '../repositories/informatives.repository';
import { InformativeResponseDto } from '../dto/informative-response.dto';
import { InformativeEntity } from '../entities/informative.entity';
import { toInformativeResponse } from '../mappers';
import { INFORMATIVE_ROUTE_PREFIX } from '../constants';
import { MediaTargetType } from 'src/shared/media/media-target-type.enum';
import { AnnounceInformativeService } from './announce-informative.service';

@Injectable()
export class CreateInformativeService {
  private readonly logger = new Logger(CreateInformativeService.name);

  constructor(
    private readonly informativesRepo: InformativesRepository,
    private readonly createRouteService: CreateRouteService,
    private readonly announceService: AnnounceInformativeService,
  ) {}

  async createInformative(
    dto: CreateInformativeDto,
  ): Promise<InformativeResponseDto> {
    this.logger.verbose(`→ createInformative | title="${dto.title}"`);

    try {
      // A transação é aberta pelo repositório; aqui só se decide o que entra
      // nela. O rollback acontece sozinho quando o bloco lança.
      const informative = await this.informativesRepo.runInTransaction(
        async (manager) => {
          const saved = await this.persistInformative(manager, dto);
          await this.attachRoute(manager, saved, dto);

          return saved;
        },
      );

      this.logger.debug('✅  Transaction committed');

      // Depois do commit e fora da requisição: o informativo já existe, e o
      // aviso é consequência dele, não condição.
      this.announceService.announceInBackground(informative);

      return toInformativeResponse(informative);
    } catch (err: unknown) {
      const error = err instanceof Error ? err : new Error(String(err));
      this.logger.error('💥  Transaction rolled‑back', error.stack);
      if (err instanceof AppException) {
        throw err;
      }
      throw new AppInternalException(
        ErrorCode.INTERNAL_ERROR,
        'Erro ao criar o banner informativo.',
      );
    }
  }

  private async persistInformative(
    manager: EntityManager,
    dto: CreateInformativeDto,
  ): Promise<InformativeEntity> {
    this.logger.debug('📝 persistInformative()');

    const saved = await this.informativesRepo.createInTransaction(manager, {
      title: dto.title,
      description: dto.description,
      public: dto.public,
    });
    this.logger.debug(`   ↳ Informative saved (ID=${saved.id})`);

    return saved;
  }

  private async attachRoute(
    manager: EntityManager,
    informative: InformativeEntity,
    dto: CreateInformativeDto,
  ): Promise<void> {
    this.logger.debug('🛤️  attachRoute()');

    const path = await this.createRouteService.generateAvailablePath(
      dto.title,
      INFORMATIVE_ROUTE_PREFIX,
    );
    this.logger.debug(`   ↳ availablePath="${path}"`);

    const route = await this.createRouteService.createRouteWithManager(
      manager,
      {
        title: dto.title,
        subtitle: dto.description,
        description: dto.description,
        path,
        type: RouteType.OTHER,
        entityId: informative.id,
        idToFetch: informative.id,
        entityType: MediaTargetType.Informative,
        image: '',
        public: dto.public,
      },
    );

    informative.route = route;
    await this.informativesRepo.saveInTransaction(manager, informative);
    this.logger.verbose(`   ↩  attachRoute() OK | routeID=${route.id}`);
  }
}
