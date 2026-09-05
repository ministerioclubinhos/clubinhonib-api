import { Injectable, Logger } from '@nestjs/common';

import {
  AppException,
  AppInternalException,
  ErrorCode,
} from 'src/shared/exceptions';
import { DeleteRouteService } from 'src/modules/routes/services/delete-route.service';

import { InformativesRepository } from '../repositories/informatives.repository';
import { GetInformativeService } from './get-informative.service';

@Injectable()
export class DeleteInformativeService {
  private readonly logger = new Logger(DeleteInformativeService.name);

  constructor(
    private readonly informativeRepo: InformativesRepository,
    private readonly getService: GetInformativeService,
    private readonly deleteRouteService: DeleteRouteService,
  ) {}

  async execute(id: string): Promise<void> {
    this.logger.log(`🗑️ [DELETE] Removendo banner ID=${id}`);

    const informative = await this.getService.findEntityOrFail(id);
    const routeId = informative.route?.id;

    try {
      // O informativo sai primeiro: a rota é o lado apontado pela FK, e removê-la
      // antes deixaria o banner órfão caso a exclusão seguinte falhasse.
      await this.informativeRepo.remove(informative);

      if (routeId) {
        await this.deleteRouteService.removeRoute(routeId);
        this.logger.log(`🧹 Rota associada removida: routeId=${routeId}`);
      }

      this.logger.log(`✅ Banner removido com sucesso: ID=${id}`);
    } catch (error: unknown) {
      if (error instanceof AppException) throw error;

      const errStack = error instanceof Error ? error.stack : undefined;
      this.logger.error(`❌ Erro ao remover banner ID=${id}`, errStack);
      throw new AppInternalException(
        ErrorCode.DATABASE_ERROR,
        'Erro ao remover banner.',
      );
    }
  }
}
