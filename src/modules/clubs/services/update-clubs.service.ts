import { Injectable, Logger } from '@nestjs/common';
import {
  AppForbiddenException,
  AppNotFoundException,
  ErrorCode,
} from 'src/shared/exceptions';
import { SyncClubEventService } from 'src/modules/pages/event-page/services/sync-club-event.service';
import { ClubsRepository } from '../repositories/clubs.repository';
import { UpdateClubDto } from '../dto/update-club.dto';
import { ClubResponseDto } from '../dto/club.response.dto';
import { ClubAccessContext } from '../types';
import { toClubResponse } from '../mappers';
import { assertCanManageClubs, normalizedRole } from '../utils';
import { GetClubsService } from './get-clubs.service';

@Injectable()
export class UpdateClubsService {
  private readonly logger = new Logger(UpdateClubsService.name);

  constructor(
    private readonly clubsRepository: ClubsRepository,
    private readonly getService: GetClubsService,
    private readonly syncClubEvent: SyncClubEventService,
  ) {}

  async update(
    id: string,
    dto: UpdateClubDto,
    context: ClubAccessContext,
  ): Promise<ClubResponseDto> {
    assertCanManageClubs(context);
    await this.assertAccessToClub(id, context);

    if (normalizedRole(context) === 'coordinator') {
      await this.assertCoordinatorAssignment(dto, context);
    }

    const club = await this.clubsRepository.updateClub(id, dto);
    this.logger.log(`Clubinho atualizado. ID=${id}`);

    // Dia, horário, endereço e situação definem o encontro semanal; a
    // sincronização roda sempre e mantém a mesma linha do calendário.
    await this.syncClubEvent.syncFromClub(club);

    return toClubResponse(club);
  }

  /**
   * Inverte a situação do clubinho.
   *
   * É uma escrita, então mora aqui e não no serviço de leitura — e, como muda
   * `isActive`, precisa refletir no calendário: um clubinho inativo não deve
   * continuar com encontro marcado.
   */
  async toggleActive(
    id: string,
    context: ClubAccessContext,
  ): Promise<ClubResponseDto> {
    assertCanManageClubs(context);

    const current = await this.getService.findEntityOrFail(id, context);
    const club = await this.clubsRepository.updateClub(id, {
      isActive: !current.isActive,
    });

    this.logger.log(
      `Clubinho ${club.isActive ? 'ativado' : 'desativado'}. ID=${id}`,
    );

    await this.syncClubEvent.syncFromClub(club);

    return toClubResponse(club);
  }

  /** Coordenador só mexe no que está sob a coordenação dele. */
  private async assertAccessToClub(
    id: string,
    context: ClubAccessContext,
  ): Promise<void> {
    if (normalizedRole(context) !== 'coordinator') return;

    const allowed = await this.clubsRepository.userHasAccessToClub(id, context);
    if (!allowed) {
      throw new AppNotFoundException(
        ErrorCode.CLUB_NOT_FOUND,
        'Clubinho não encontrado',
      );
    }
  }

  /** Coordenador não transfere o clubinho para outra coordenação. */
  private async assertCoordinatorAssignment(
    dto: UpdateClubDto,
    context: ClubAccessContext,
  ): Promise<void> {
    if (dto.coordinatorProfileId === undefined) return;

    const ownProfileId =
      await this.clubsRepository.getCoordinatorProfileIdByUserId(
        context.userId as string,
      );

    if (!ownProfileId) {
      throw new AppForbiddenException(
        ErrorCode.CLUB_ACCESS_DENIED,
        'Acesso negado',
      );
    }

    if (
      dto.coordinatorProfileId !== null &&
      dto.coordinatorProfileId !== ownProfileId
    ) {
      throw new AppForbiddenException(
        ErrorCode.CLUB_ACCESS_DENIED,
        'Não é permitido atribuir outro coordenador',
      );
    }
  }
}
