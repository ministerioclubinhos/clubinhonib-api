import { Injectable, Logger, Inject } from '@nestjs/common';
import {
  AppNotFoundException,
  AppInternalException,
  ErrorCode,
} from 'src/shared/exceptions';
import { InformativeRepository } from '../informative.repository';
import { RouteRepository } from 'src/modules/routes/route-page.repository';

@Injectable()
export class DeleteInformativeService {
  private readonly logger = new Logger(DeleteInformativeService.name);

  constructor(
    @Inject(InformativeRepository)
    private readonly informativeRepo: InformativeRepository,

    @Inject(RouteRepository)
    private readonly routeRepo: RouteRepository,
  ) {}

  async execute(id: string): Promise<void> {
    this.logger.log(`🗑️ [DELETE] Iniciando remoção do banner ID=${id}`);

    const informative = await this.informativeRepo.findOneWithRelations(id);

    if (!informative) {
      this.logger.warn(`⚠️ Banner não encontrado: ID=${id}`);
      throw new AppNotFoundException(
        ErrorCode.INFORMATIVE_NOT_FOUND,
        'Banner informativo não encontrado',
      );
    }

    try {
      if (informative.route) {
        await this.routeRepo.delete(informative.route.id);
        this.logger.log(
          `🧹 Rota associada removida: routeId=${informative.route.id}`,
        );
      }

      await this.informativeRepo.remove(informative);
      this.logger.log(`✅ Banner removido com sucesso: ID=${id}`);
    } catch (error) {
      this.logger.error(`❌ Erro ao remover banner ID=${id}`, error.stack);
      throw new AppInternalException(
        ErrorCode.DATABASE_ERROR,
        'Erro ao remover banner.',
      );
    }
  }
}
