import { Injectable, Logger } from '@nestjs/common';
import { AppNotFoundException, ErrorCode } from 'src/shared/exceptions';
import { SyncClubEventService } from 'src/modules/pages/event-page/services/sync-club-event.service';
import { ClubsRepository } from '../repositories/clubs.repository';
import { ClubAccessContext } from '../types';
import { assertCanManageClubs, normalizedRole } from '../utils';

@Injectable()
export class DeleteClubsService {
  private readonly logger = new Logger(DeleteClubsService.name);

  constructor(
    private readonly clubsRepository: ClubsRepository,
    private readonly syncClubEvent: SyncClubEventService,
  ) {}

  async remove(
    id: string,
    context: ClubAccessContext,
  ): Promise<{ message: string }> {
    assertCanManageClubs(context);

    // Coordenador só remove o que está sob a coordenação dele.
    if (normalizedRole(context) === 'coordinator') {
      const allowed = await this.clubsRepository.userHasAccessToClub(
        id,
        context,
      );
      if (!allowed) {
        throw new AppNotFoundException(
          ErrorCode.CLUB_NOT_FOUND,
          'Clubinho não encontrado',
        );
      }
    }

    // O encontro sai do calendário antes: depois da exclusão não há mais de
    // onde tirar o vínculo.
    await this.syncClubEvent.removeForClub(id);
    await this.clubsRepository.deleteById(id);

    this.logger.log(`Clubinho removido. ID=${id}`);

    return { message: 'Clubinho removido com sucesso' };
  }
}
