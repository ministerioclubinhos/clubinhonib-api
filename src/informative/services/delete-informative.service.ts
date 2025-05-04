import {
  Injectable,
  Logger,
  NotFoundException,
  Inject,
  InternalServerErrorException,
} from '@nestjs/common';
import { InformativeRepository } from '../informative.repository';
import { RouteRepository } from 'src/route/route-page.repository';

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
      throw new NotFoundException('Banner informativo não encontrado');
    }

    try {
      if (informative.route) {
        await this.routeRepo.delete(informative.route.id);
        this.logger.log(`🧹 Rota associada removida: routeId=${informative.route.id}`);
      }

      await this.informativeRepo.remove(informative);
      this.logger.log(`✅ Banner removido com sucesso: ID=${id}`);
    } catch (error) {
      this.logger.error(`❌ Erro ao remover banner ID=${id}`, error.stack);
      throw new InternalServerErrorException('Erro ao remover banner.');
    }
  }
}
