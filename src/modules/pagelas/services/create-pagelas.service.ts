import { Injectable, Logger } from '@nestjs/common';

import { AppForbiddenException, ErrorCode } from 'src/shared/exceptions';

import { PagelasRepository } from '../repositories/pagelas.repository';
import { CreatePagelaDto } from '../dto/create-pagela.dto';
import { PagelaResponseDto } from '../dto/pagela-response.dto';
import { PagelaAccessContext } from '../types';
import { toPagelaResponse } from '../mappers';
import { assertCanAccessPagelas } from '../utils';
import { ResolvePagelaWeekService } from './resolve-pagela-week.service';

@Injectable()
export class CreatePagelasService {
  private readonly logger = new Logger(CreatePagelasService.name);

  constructor(
    private readonly pagelasRepository: PagelasRepository,
    private readonly weekService: ResolvePagelaWeekService,
  ) {}

  async create(
    dto: CreatePagelaDto,
    context: PagelaAccessContext,
  ): Promise<PagelaResponseDto> {
    assertCanAccessPagelas(context);
    await this.assertChildIsWithinReach(dto.childId, context);

    const { year, week } = await this.resolveWeek(dto);

    const created = await this.pagelasRepository.createOne({
      childId: dto.childId,
      teacherProfileId: dto.teacherProfileId ?? null,
      referenceDate: dto.referenceDate,
      year,
      week,
      present: dto.present,
      didMeditation: dto.didMeditation,
      recitedVerse: dto.recitedVerse,
      notes: dto.notes ?? null,
    });

    this.logger.log(
      `Pagela criada. ID=${created.id} criança=${dto.childId} ` +
        `semana=${week}/${year}`,
    );

    return toPagelaResponse(created);
  }

  /**
   * Semana e ano da pagela.
   *
   * O que vier no corpo manda; o que faltar sai do período letivo. Informar só
   * a semana não pode deixar o ano em branco, então a conta roda sempre que
   * algum dos dois estiver ausente.
   */
  private async resolveWeek(
    dto: CreatePagelaDto,
  ): Promise<{ year: number; week: number }> {
    if (dto.year != null && dto.week != null) {
      return { year: dto.year, week: dto.week };
    }

    const resolved = await this.weekService.resolve(dto.referenceDate, true);

    return {
      year: dto.year ?? resolved.year,
      week: dto.week ?? resolved.week,
    };
  }

  /** Coordenador e professor só registram pagela de criança do alcance deles. */
  private async assertChildIsWithinReach(
    childId: string,
    context: PagelaAccessContext,
  ): Promise<void> {
    const allowed = await this.pagelasRepository.childIsWithinReach(
      childId,
      context,
    );

    if (!allowed) {
      throw new AppForbiddenException(
        ErrorCode.CHILD_ACCESS_DENIED,
        'Sem acesso à criança informada',
      );
    }
  }
}
