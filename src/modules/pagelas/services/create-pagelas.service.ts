import { Injectable, Logger } from '@nestjs/common';

import { AppForbiddenException, ErrorCode } from 'src/shared/exceptions';

import { PagelasRepository } from '../repositories/pagelas.repository';
import { CreatePagelaDto } from '../dto/create-pagela.dto';
import { PagelaResponseDto } from '../dto/pagela-response.dto';
import { PagelaAccessContext } from '../types';
import { toPagelaResponse } from '../mappers';
import { assertCanAccessPagelas, inactiveChildRefusal } from '../utils';
import { PagelaLaunchWindowService } from './pagela-launch-window.service';

@Injectable()
export class CreatePagelasService {
  private readonly logger = new Logger(CreatePagelasService.name);

  constructor(
    private readonly pagelasRepository: PagelasRepository,
    private readonly launchWindow: PagelaLaunchWindowService,
  ) {}

  async create(
    dto: CreatePagelaDto,
    context: PagelaAccessContext,
  ): Promise<PagelaResponseDto> {
    assertCanAccessPagelas(context);
    await this.assertChildIsWithinReach(dto.childId, context);
    // Criança desativada saiu do clubinho: não recebe pagela.
    if (!(await this.pagelasRepository.childIsActive(dto.childId))) {
      throw inactiveChildRefusal();
    }

    // Fora do período letivo não se lança pagela; dentro dele, só de semana que
    // já aconteceu.
    const { year, week } = await this.launchWindow.resolveForCreation(dto);

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
