import { Injectable, Logger } from '@nestjs/common';

import { clubMeetingDescription, clubMeetingTitle } from '../constants';
import { EventRepository } from '../repositories/event.repository';
import {
  ClubMeetingSource,
  ClubMeetingSummary,
  ReconcileClubEventsResult,
} from '../types';
import { SyncClubEventService } from './sync-club-event.service';

/**
 * Coloca no calendário os clubinhos que ficaram de fora.
 *
 * Serve a dois consertos de base: clubinho ativo que ficou sem os dias dele no
 * calendário, e clubinho inativo que ficou com dias sobrando. Também atualiza a
 * linha cujo título ou descrição não são mais os que o código produz.
 *
 * Três garantias, porque o risco aqui é criar encontro repetido:
 *
 * - **só mexe no que está errado**: a situação de todos os clubinhos é lida de
 *   uma vez e um clubinho já correto não é tocado;
 * - **repetir não muda nada**: rodar duas vezes seguidas não cria nem remove
 *   linha nenhuma;
 * - **o banco decide**: a restrição de unicidade em `club_id` torna uma segunda
 *   linha para o mesmo clubinho impossível, mesmo se duas instâncias subirem
 *   juntas. Uma perde a corrida, o erro é registrado e a outra já gravou o
 *   certo.
 */
@Injectable()
export class ReconcileClubEventsService {
  private readonly logger = new Logger(ReconcileClubEventsService.name);

  constructor(
    private readonly eventRepo: EventRepository,
    private readonly syncClubEvent: SyncClubEventService,
  ) {}

  async reconcile(
    clubs: ClubMeetingSource[],
  ): Promise<ReconcileClubEventsResult> {
    const summaries = await this.eventRepo.findClubMeetingSummaries();
    const seriesByClub = new Map(
      summaries.map((summary) => [summary.clubId, summary]),
    );

    const result: ReconcileClubEventsResult = {
      created: 0,
      removed: 0,
      refreshed: 0,
      untouched: 0,
    };

    for (const club of clubs) {
      const series = seriesByClub.get(club.id);

      // Clubinho ativo sem encontro: é o que precisa entrar no calendário.
      if (club.isActive && !series) {
        if (await this.createFor(club)) result.created += 1;
        continue;
      }

      // Clubinho inativo que ainda tem dias no calendário: some com eles.
      if (!club.isActive && series) {
        await this.syncClubEvent.removeForClub(club.id);
        result.removed += 1;
        continue;
      }

      // Linha com texto antigo: o título e a descrição saem do número do
      // clubinho, então mudar o texto no código não alcançaria os encontros já
      // gravados — eles só seriam atualizados na próxima edição do clubinho.
      if (club.isActive && series && this.hasStaleContent(club, series)) {
        if (await this.createFor(club)) result.refreshed += 1;
        continue;
      }

      result.untouched += 1;
    }

    if (result.created > 0 || result.removed > 0 || result.refreshed > 0) {
      this.logger.log(
        `Dias de clubinho reconciliados: ${result.created} criado(s), ` +
          `${result.removed} removido(s), ${result.refreshed} atualizado(s), ` +
          `${result.untouched} sem mudança.`,
      );
    }

    return result;
  }

  /**
   * Cria o encontro de um clubinho, sem deixar o erro escapar.
   *
   * Um clubinho com cadastro problemático não pode impedir os outros de entrar
   * no calendário — e a corrida contra o índice único, se duas instâncias
   * subirem ao mesmo tempo, chega aqui como erro de gravação com a linha certa
   * já no banco.
   */
  private async createFor(club: ClubMeetingSource): Promise<boolean> {
    try {
      await this.syncClubEvent.syncFromClub(club);
      return true;
    } catch (error: unknown) {
      this.logger.error(
        `Não foi possível criar o encontro do clubinho #${club.number}.`,
        error instanceof Error ? error.stack : undefined,
      );
      return false;
    }
  }

  /** True quando o texto gravado não é mais o que o código produz. */
  private hasStaleContent(
    club: ClubMeetingSource,
    series: ClubMeetingSummary,
  ): boolean {
    return (
      series.title !== clubMeetingTitle(club.number) ||
      series.description !== clubMeetingDescription(club.number)
    );
  }
}
