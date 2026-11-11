import { Injectable, Logger } from '@nestjs/common';

import { PagelasRepository } from '../repositories/pagelas.repository';
import { UpdatePagelaDto } from '../dto/update-pagela.dto';
import { PagelaResponseDto } from '../dto/pagela-response.dto';
import { PagelaAccessContext, PagelaUpdateData } from '../types';
import { toPagelaResponse } from '../mappers';
import { inactiveChildRefusal } from '../utils';
import { GetPagelasService } from './get-pagelas.service';
import { PagelaLaunchWindowService } from './pagela-launch-window.service';

@Injectable()
export class UpdatePagelasService {
  private readonly logger = new Logger(UpdatePagelasService.name);

  constructor(
    private readonly pagelasRepository: PagelasRepository,
    private readonly getService: GetPagelasService,
    private readonly launchWindow: PagelaLaunchWindowService,
  ) {}

  async update(
    id: string,
    dto: UpdatePagelaDto,
    context: PagelaAccessContext,
  ): Promise<PagelaResponseDto> {
    // Fora do alcance de quem pede, a pagela simplesmente não existe.
    const stored = await this.getService.findEntityOrFail(id, context);

    // Criança desativada saiu do clubinho: a pagela dela não é mais editada.
    if (!(await this.pagelasRepository.childIsActive(stored.child.id))) {
      throw inactiveChildRefusal();
    }

    // Fora do período letivo nada se edita. Dentro dele, só o que a edição
    // muda de data e semana é conferido.
    const week = await this.launchWindow.resolveForUpdate(dto, {
      year: stored.year,
      week: stored.week,
      referenceDate: stored.referenceDate,
    });

    const data: PagelaUpdateData = {
      referenceDate: dto.referenceDate,
      year: week?.year,
      week: week?.week,
      present: dto.present,
      didMeditation: dto.didMeditation,
      recitedVerse: dto.recitedVerse,
      notes: dto.notes,
      teacherProfileId: dto.teacherProfileId,
    };
    const updated = await this.pagelasRepository.updateOne(id, data);

    this.logger.log(`Pagela atualizada. ID=${id}`);

    return toPagelaResponse(updated);
  }
}
