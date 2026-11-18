import { Controller, Get, Logger, Query, Req, UseGuards } from '@nestjs/common';
import { Request } from 'express';

import { AccessContext } from 'src/core/auth/auth.types';
import { JwtAuthGuard } from 'src/core/auth/guards/jwt-auth.guard';
import { AdminOrLeaderRoleGuard } from 'src/core/auth/guards/role-guard';
import { AuthContextService } from 'src/core/auth/services/auth-context.service';

import { ClubWeeklySummaryQueryDto } from '../dto/club-weekly-summary-query.dto';
import { ClubWeeklySummaryDto } from '../dto/club-weekly-summary.dto';
import { GetClubWeeklySummaryService } from '../services/get-club-weekly-summary.service';

/**
 * O resumo semanal dos clubinhos.
 *
 * Fica fora de `ClubControlController` porque aquele é inteiro do
 * administrador: um guard de classe soma-se ao do método, então não há como
 * abrir uma rota para o coordenador ali dentro. O recorte por clubinho é do
 * caso de uso, e vale igual para os dois perfis.
 */
@Controller('club-control/weekly-summary')
@UseGuards(JwtAuthGuard, AdminOrLeaderRoleGuard)
export class ClubWeeklySummaryController {
  private readonly logger = new Logger(ClubWeeklySummaryController.name);

  constructor(
    private readonly getClubWeeklySummaryService: GetClubWeeklySummaryService,
    private readonly authContext: AuthContextService,
  ) {}

  @Get()
  async getSummary(
    @Query() query: ClubWeeklySummaryQueryDto,
    @Req() request: Request,
  ): Promise<ClubWeeklySummaryDto> {
    this.logger.log(
      `GET /club-control/weekly-summary year=${query.year ?? 'atual'}`,
    );

    const context: AccessContext =
      await this.authContext.resolveAccessContext(request);

    return this.getClubWeeklySummaryService.getSummary(context, query);
  }
}
