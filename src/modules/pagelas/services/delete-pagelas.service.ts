import { Injectable, Logger } from '@nestjs/common';

import { PagelasRepository } from '../repositories/pagelas.repository';
import { PagelaAccessContext } from '../types';
import { GetPagelasService } from './get-pagelas.service';

@Injectable()
export class DeletePagelasService {
  private readonly logger = new Logger(DeletePagelasService.name);

  constructor(
    private readonly pagelasRepository: PagelasRepository,
    private readonly getService: GetPagelasService,
  ) {}

  async remove(
    id: string,
    context: PagelaAccessContext,
  ): Promise<{ message: string }> {
    // Fora do alcance de quem pede, a pagela simplesmente não existe — antes
    // qualquer autenticado apagava a pagela de qualquer criança.
    await this.getService.findEntityOrFail(id, context);

    await this.pagelasRepository.deleteById(id);
    this.logger.log(`Pagela removida. ID=${id}`);

    return { message: 'Pagela removida com sucesso' };
  }
}
