import { Injectable } from '@nestjs/common';
import { Request } from 'express';
import { ClubsRepository } from '../repositories/clubs.repository';
import { CreateClubDto } from '../dto/create-club.dto';
import { AuthContextService } from 'src/core/auth/services/auth-context.service';
import { AppForbiddenException, ErrorCode } from 'src/shared/exceptions';
import { SyncClubEventService } from 'src/modules/pages/event-page/services/sync-club-event.service';

type Ctx = { role?: string; userId?: string | null };

@Injectable()
export class CreateClubsService {
  constructor(
    private readonly clubsRepository: ClubsRepository,
    private readonly authCtx: AuthContextService,
    private readonly syncClubEvent: SyncClubEventService,
  ) {}

  private async getCtx(req: Request): Promise<Ctx> {
    const p = await this.authCtx.tryGetPayload(req);
    return { role: p?.role?.toLowerCase(), userId: p?.sub ?? null };
  }

  async create(dto: CreateClubDto, req: Request) {
    const ctx = await this.getCtx(req);
    if (!ctx.role || ctx.role === 'teacher') {
      throw new AppForbiddenException(
        ErrorCode.CLUB_ACCESS_DENIED,
        'Acesso negado',
      );
    }

    if (ctx.role === 'coordinator') {
      const myCoordId =
        await this.clubsRepository.getCoordinatorProfileIdByUserId(ctx.userId!);
      if (!myCoordId)
        throw new AppForbiddenException(
          ErrorCode.CLUB_ACCESS_DENIED,
          'Acesso negado',
        );

      if (dto.coordinatorProfileId && dto.coordinatorProfileId !== myCoordId) {
        throw new AppForbiddenException(
          ErrorCode.CLUB_ACCESS_DENIED,
          'Não é permitido atribuir outro coordenador',
        );
      }
      dto.coordinatorProfileId = myCoordId;
    }

    const club = await this.clubsRepository.createClub(dto);

    // O encontro semanal entra no calendário junto com o clubinho.
    await this.syncClubEvent.syncFromClub(club);

    return club;
  }
}
