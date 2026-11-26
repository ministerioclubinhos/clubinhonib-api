import { Injectable, Logger } from '@nestjs/common';

import { GetUsersService } from 'src/core/user/services/get-user.service';
import { EmailRecipient } from 'src/shared/email';

import { ClubsRepository } from '../repositories/clubs.repository';
import { ClubRecipients } from '../types';

/**
 * Quem avisar sobre um clubinho: os professores dele e o coordenador.
 *
 * Existe porque as consultas de clube não sabem nada de elegibilidade. Elas já
 * trazem `teachers[].user.email` e `coordinator.user.email` — mas trariam
 * também o professor desativado e quem pediu para sair dos avisos, porque
 * `active` e `noticesUnsubscribedAt` só são conferidos no módulo de usuário.
 *
 * A divisão é essa: aqui se responde **quem** tem a ver com o clube, e o
 * `GetUsersService` responde **se essa pessoa pode receber**. Assim a régua de
 * descadastro continua num lugar só, e não é reescrita a cada aviso novo.
 */
@Injectable()
export class GetClubRecipientsService {
  private readonly logger = new Logger(GetClubRecipientsService.name);

  constructor(
    private readonly clubsRepository: ClubsRepository,
    private readonly getUsersService: GetUsersService,
  ) {}

  /**
   * Os destinatários de um clubinho.
   *
   * Clube sem coordenador e clube sem professor são estados normais — as duas
   * pontas são anuláveis no schema —, então a resposta pode vir vazia sem que
   * nada tenha dado errado.
   */
  async forClub(clubId: string): Promise<ClubRecipients> {
    const club = await this.clubsRepository.findByIdWithRelationsOrFail(clubId);

    const teacherUserIds = (club.teachers ?? [])
      .map((teacher) => teacher.user?.id)
      .filter((id): id is string => Boolean(id));
    const coordinatorUserId = club.coordinator?.user?.id ?? null;

    const eligible = await this.getUsersService.findNoticeRecipientsByIds([
      ...teacherUserIds,
      ...(coordinatorUserId ? [coordinatorUserId] : []),
    ]);

    const byId = new Map(eligible.map((person) => [person.id, person]));

    return {
      clubId: club.id,
      clubNumber: club.number,
      teachers: teacherUserIds
        .map((id) => byId.get(id))
        .filter((person): person is EmailRecipient => Boolean(person)),
      coordinator:
        (coordinatorUserId ? byId.get(coordinatorUserId) : undefined) ?? null,
    };
  }

  /**
   * O mesmo para vários clubinhos, indexado por id.
   *
   * Um clube que falhar não derruba os outros: o aviso do domingo percorre
   * dezenas deles, e um clube apagado no meio do caminho não pode calar o resto.
   */
  async forClubs(clubIds: string[]): Promise<Map<string, ClubRecipients>> {
    const found = new Map<string, ClubRecipients>();

    for (const clubId of [...new Set(clubIds)]) {
      try {
        found.set(clubId, await this.forClub(clubId));
      } catch (error: unknown) {
        this.logger.warn(
          `Destinatários do clubinho ${clubId} não carregados: ${
            error instanceof Error ? error.message : String(error)
          }`,
        );
      }
    }

    return found;
  }
}
