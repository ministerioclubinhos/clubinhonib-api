import { Injectable, Logger } from '@nestjs/common';
import {
  AppException,
  AppInternalException,
  ErrorCode,
} from 'src/shared/exceptions';
import { DataSource, QueryRunner } from 'typeorm';
import { RouteService } from 'src/modules/routes/route.service';
import { RouteType } from 'src/modules/routes/route-page.entity';
import { CreateInformativeDto } from '../dto/create-informative.dto';
import { InformativeResponseDto } from '../dto/informative-response.dto';
import { InformativeEntity } from '../entities/informative.entity';
import { toInformativeResponse } from '../mappers';
import { INFORMATIVE_ROUTE_PREFIX } from '../constants';
import { MediaTargetType } from 'src/shared/media/media-target-type.enum';

@Injectable()
export class CreateInformativeService {
  private readonly logger = new Logger(CreateInformativeService.name);

  constructor(
    private readonly dataSource: DataSource,
    private readonly routeService: RouteService,
  ) {}

  async createInformative(
    dto: CreateInformativeDto,
  ): Promise<InformativeResponseDto> {
    this.logger.verbose(`→ createInformative | title="${dto.title}"`);

    const runner = this.dataSource.createQueryRunner();
    await runner.connect();
    await runner.startTransaction();
    this.logger.debug('▶️  Transaction started');

    try {
      const informative = await this.persistInformative(runner, dto);
      await this.attachRoute(runner, informative, dto);

      await runner.commitTransaction();
      this.logger.debug('✅  Transaction committed');

      return toInformativeResponse(informative);
    } catch (err: unknown) {
      await runner.rollbackTransaction();
      const error = err instanceof Error ? err : new Error(String(err));
      this.logger.error('💥  Transaction rolled‑back', error.stack);
      if (err instanceof AppException) {
        throw err;
      }
      throw new AppInternalException(
        ErrorCode.INTERNAL_ERROR,
        'Erro ao criar o banner informativo.',
      );
    } finally {
      await runner.release();
      this.logger.debug('⛔  QueryRunner released');
    }
  }

  private async persistInformative(
    runner: QueryRunner,
    dto: CreateInformativeDto,
  ): Promise<InformativeEntity> {
    this.logger.debug('📝 persistInformative()');

    const repo = runner.manager.getRepository(InformativeEntity);
    const entity = repo.create({
      title: dto.title,
      description: dto.description,
      public: dto.public,
    });
    const saved = await repo.save(entity);
    this.logger.debug(`   ↳ Informative saved (ID=${saved.id})`);

    return saved;
  }

  private async attachRoute(
    runner: QueryRunner,
    informative: InformativeEntity,
    dto: CreateInformativeDto,
  ): Promise<void> {
    this.logger.debug('🛤️  attachRoute()');

    const path = await this.routeService.generateAvailablePath(
      dto.title,
      INFORMATIVE_ROUTE_PREFIX,
    );
    this.logger.debug(`   ↳ availablePath="${path}"`);

    const route = await this.routeService.createRouteWithManager(
      runner.manager,
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
    await runner.manager.save(informative);
    this.logger.verbose(`   ↩  attachRoute() OK | routeID=${route.id}`);
  }
}
