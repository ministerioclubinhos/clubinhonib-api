import { Injectable, Logger } from '@nestjs/common';
import { SyncClubEventService } from 'src/modules/pages/event-page/services/sync-club-event.service';
import { ClubsRepository } from '../repositories/clubs.repository';
import { ClubAccessContext } from '../types';
import { assertCanDeleteClub } from '../utils';

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
    // Exclusão é só do administrador. O coordenador administra o clubinho
    // dele — dia, horário, endereço, equipe — e pode desativá-lo, que é a
    // operação com volta.
    assertCanDeleteClub(context);

    // Os dias saem do calendário antes: depois da exclusão não há mais de onde
    // tirar o vínculo.
    await this.syncClubEvent.removeForClub(id);
    await this.clubsRepository.deleteById(id);

    this.logger.log(`Clubinho removido. ID=${id}`);

    return { message: 'Clubinho removido com sucesso' };
  }
}
