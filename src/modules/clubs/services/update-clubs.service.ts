import { Injectable } from '@nestjs/common';
import { Request } from 'express';
import { ClubsRepository } from '../repositories/clubs.repository';
import { UpdateClubDto } from '../dto/update-club.dto';
import { AuthContextService } from 'src/core/auth/services/auth-context.service';
import { SyncClubEventService } from 'src/modules/pages/event-page/services/sync-club-event.service';
import {
  AppNotFoundException,
  AppForbiddenException,
  ErrorCode,
} from 'src/shared/exceptions';

type Ctx = { role?: string; userId?: string | null };

@Injectable()
export class UpdateClubsService {
  constructor(
    private readonly clubsRepository: ClubsRepository,
    private readonly authCtx: AuthContextService,
    private readonly syncClubEvent: SyncClubEventService,
  ) {}

  private async getCtx(req: Request): Promise<Ctx> {
    const p = await this.authCtx.tryGetPayload(req);
    return { role: p?.role?.toLowerCase(), userId: p?.sub ?? null };
  }

  async update(id: string, dto: UpdateClubDto, req: Request) {
    const ctx = await this.getCtx(req);
    if (!ctx.role || ctx.role === 'teacher')
      throw new AppForbiddenException(
        ErrorCode.CLUB_ACCESS_DENIED,
        'Acesso negado',
      );

    if (ctx.role === 'coordinator') {
      const allowed = await this.clubsRepository.userHasAccessToClub(id, ctx);
      if (!allowed)
        throw new AppNotFoundException(
          ErrorCode.CLUB_NOT_FOUND,
          'Clubinho não encontrado',
        );

      if (dto.coordinatorProfileId !== undefined) {
        const myCoordId =
          await this.clubsRepository.getCoordinatorProfileIdByUserId(
            ctx.userId!,
          );
        if (!myCoordId)
          throw new AppForbiddenException(
            ErrorCode.CLUB_ACCESS_DENIED,
            'Acesso negado',
          );
        if (
          dto.coordinatorProfileId !== null &&
          dto.coordinatorProfileId !== myCoordId
        ) {
          throw new AppForbiddenException(
            ErrorCode.CLUB_ACCESS_DENIED,
            'Não é permitido atribuir outro coordenador',
          );
        }
        if (dto.coordinatorProfileId === undefined) {
          dto.coordinatorProfileId = myCoordId;
        }
      }
    }

    const club = await this.clubsRepository.updateClub(id, dto);

    // Dia, horário, endereço e situação do clubinho definem o encontro; a
    // sincronização roda sempre e mantém a mesma linha do calendário.
    await this.syncClubEvent.syncFromClub(club);

    return club;
  }
}
