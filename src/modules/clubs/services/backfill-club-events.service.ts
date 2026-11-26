import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';

import { ReconcileClubEventsService } from 'src/modules/pages/event-page/services/reconcile-club-events.service';

import { ClubsRepository } from '../repositories/clubs.repository';

/**
 * Garante, na subida da API, que todo clubinho tem seu encontro no calendário.
 *
 * O código anterior apagava a linha do encontro quando o clubinho era
 * desativado. A regra atual encerra a série em vez de apagá-la, para que os
 * encontros já realizados continuem visíveis — e esses clubinhos precisam
 * recuperar o registro que perderam.
 *
 * Roda no boot, e não como job agendado, porque é conserto de base e não
 * rotina: depois da primeira execução não há mais nada a fazer, e as execuções
 * seguintes só confirmam isso.
 *
 * Roda em **toda** instância, de propósito. Já esteve atrás de
 * `SCHEDULER_ENABLED` para poupar duas consultas nas réplicas, e foi um mau
 * negócio: aquela chave também liga os jobs de e-mail, então ambiente sem ela
 * — o dev — ficava sem reconciliação, e os dias de clubinho seguiam com o
 * título antigo até alguém editar cada clubinho. Ligar a chave lá resolveria a
 * reconciliação e faria o dev mandar cobrança de pagela para professor de
 * verdade.
 *
 * O custo de rodar em todo lugar são duas consultas por subida, e nenhuma
 * escrita quando não há o que consertar. Duplicar continua impossível: a
 * reconciliação só cria o que falta e a unicidade de `club_id` recusa uma
 * segunda linha para o mesmo clubinho.
 */
@Injectable()
export class BackfillClubEventsService implements OnApplicationBootstrap {
  private readonly logger = new Logger(BackfillClubEventsService.name);

  constructor(
    private readonly clubsRepository: ClubsRepository,
    private readonly reconcileService: ReconcileClubEventsService,
  ) {}

  async onApplicationBootstrap(): Promise<void> {
    try {
      // Sem contexto de papel: a reconciliação olha a base inteira, inclusive
      // os clubinhos inativos, que são justamente os que perderam o registro.
      const clubs = await this.clubsRepository.findAllSimple();

      await this.reconcileService.reconcile(
        clubs.map((club) => ({
          id: club.id,
          number: club.number,
          weekday: club.weekday,
          time: club.time ?? null,
          isActive: club.isActive,
          address: club.address ?? null,
        })),
      );
    } catch (error: unknown) {
      // A API sobe de qualquer jeito: um calendário incompleto é bem menos
      // grave do que o serviço inteiro fora do ar.
      this.logger.error(
        'Falha ao reconciliar os encontros dos clubinhos na subida.',
        error instanceof Error ? error.stack : undefined,
      );
    }
  }
}
