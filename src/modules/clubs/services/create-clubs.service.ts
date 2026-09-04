import { Injectable, Logger } from '@nestjs/common';
import { AppForbiddenException, ErrorCode } from 'src/shared/exceptions';
import { SyncClubEventService } from 'src/modules/pages/event-page/services/sync-club-event.service';
import { ClubsRepository } from '../repositories/clubs.repository';
import { CreateClubDto } from '../dto/create-club.dto';
import { ClubResponseDto } from '../dto/club.response.dto';
import { ClubAccessContext } from '../types';
import { toClubResponse } from '../mappers';
import {
  assertCanManageClubs,
  assertCanTakeTeachers,
  normalizedRole,
} from '../utils';

@Injectable()
export class CreateClubsService {
  private readonly logger = new Logger(CreateClubsService.name);

  constructor(
    private readonly clubsRepository: ClubsRepository,
    private readonly syncClubEvent: SyncClubEventService,
  ) {}

  async create(
    dto: CreateClubDto,
    context: ClubAccessContext,
  ): Promise<ClubResponseDto> {
    assertCanManageClubs(context);

    // Coordenador só cria clubinho sob a própria coordenação.
    if (normalizedRole(context) === 'coordinator') {
      dto.coordinatorProfileId = await this.ownCoordinatorProfileId(context);
    }

    await this.assertTeachersInScope(dto.teacherProfileIds, context);

    const club = await this.clubsRepository.createClub(dto);
    this.logger.log(`Clubinho criado. ID=${club.id} número=${club.number}`);

    // O encontro semanal entra no calendário junto com o clubinho.
    await this.syncClubEvent.syncFromClub(club);

    return toClubResponse(club);
  }

  /**
   * Perfil de coordenação de quem está criando. Um coordenador não atribui o
   * clubinho a outra pessoa.
   */
  private async ownCoordinatorProfileId(
    context: ClubAccessContext,
  ): Promise<string> {
    const profileId =
      await this.clubsRepository.getCoordinatorProfileIdByUserId(
        context.userId as string,
      );

    if (!profileId) {
      throw new AppForbiddenException(
        ErrorCode.CLUB_ACCESS_DENIED,
        'Acesso negado',
      );
    }

    return profileId;
  }

  /**
   * Trazer um professor de outro clubinho move o vínculo. O coordenador só
   * move quem já está sob a coordenação dele.
   */
  private async assertTeachersInScope(
    teacherProfileIds: string[] | undefined,
    context: ClubAccessContext,
  ): Promise<void> {
    if (!teacherProfileIds?.length) return;

    const [currentClubIdByTeacher, ownClubs] = await Promise.all([
      this.clubsRepository.findCurrentClubIdsOfTeachers(teacherProfileIds),
      this.clubsRepository.list(context),
    ]);

    assertCanTakeTeachers({
      context,
      // O clubinho ainda não existe: qualquer vínculo atual é uma mudança.
      targetClubId: null,
      currentClubIdByTeacher,
      accessibleClubIds: new Set(ownClubs.map((club) => club.id)),
    });
  }
}
