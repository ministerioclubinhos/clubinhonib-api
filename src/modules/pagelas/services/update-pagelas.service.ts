import { Injectable, Logger } from '@nestjs/common';

import { PagelasRepository } from '../repositories/pagelas.repository';
import { UpdatePagelaDto } from '../dto/update-pagela.dto';
import { PagelaResponseDto } from '../dto/pagela-response.dto';
import { PagelaAccessContext, PagelaUpdateData } from '../types';
import { toPagelaResponse } from '../mappers';
import { GetPagelasService } from './get-pagelas.service';
import { ResolvePagelaWeekService } from './resolve-pagela-week.service';

@Injectable()
export class UpdatePagelasService {
  private readonly logger = new Logger(UpdatePagelasService.name);

  constructor(
    private readonly pagelasRepository: PagelasRepository,
    private readonly getService: GetPagelasService,
    private readonly weekService: ResolvePagelaWeekService,
  ) {}

  async update(
    id: string,
    dto: UpdatePagelaDto,
    context: PagelaAccessContext,
  ): Promise<PagelaResponseDto> {
    // Fora do alcance de quem pede, a pagela simplesmente não existe.
    await this.getService.findEntityOrFail(id, context);

    const data = await this.buildUpdateData(dto);
    const updated = await this.pagelasRepository.updateOne(id, data);

    this.logger.log(`Pagela atualizada. ID=${id}`);

    return toPagelaResponse(updated);
  }

  /**
   * Campos a gravar.
   *
   * Mudar a data de referência recalcula semana e ano, a menos que o cliente
   * mande os dois. Se a nova data cair fora do período letivo, semana e ano
   * ficam como estavam: a edição não é sobre eles.
   */
  private async buildUpdateData(
    dto: UpdatePagelaDto,
  ): Promise<PagelaUpdateData> {
    const data: PagelaUpdateData = {
      referenceDate: dto.referenceDate,
      year: dto.year,
      week: dto.week,
      present: dto.present,
      didMeditation: dto.didMeditation,
      recitedVerse: dto.recitedVerse,
      notes: dto.notes,
      teacherProfileId: dto.teacherProfileId,
    };

    const needsWeek = dto.week == null || dto.year == null;
    if (!dto.referenceDate || !needsWeek) return data;

    const resolved = await this.weekService.resolve(dto.referenceDate, false);
    if (!resolved) return data;

    return {
      ...data,
      year: dto.year ?? resolved.year,
      week: dto.week ?? resolved.week,
    };
  }
}
