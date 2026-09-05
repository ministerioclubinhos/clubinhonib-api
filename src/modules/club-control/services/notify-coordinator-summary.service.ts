import { Injectable, Logger } from '@nestjs/common';

import { GetUsersService } from 'src/core/user/services/get-user.service';
import { GetCoordinatorProfilesService } from 'src/modules/coordinator-profiles/services/get-coordinator-profiles.service';
import { ResolvePagelaWeekService } from 'src/modules/pagelas/services/resolve-pagela-week.service';
import { EmailService } from 'src/shared/email';
import { CoordinatorSummaryClub } from 'src/shared/email/types';
import { SiteUrlService } from 'src/shared/site-url';

import { CLUB_CONTROL_PATHS } from '../constants';
import { ClubWeekPendency } from '../types';
import { clubWeekStatusLabel, toDateOnly } from '../utils';
import { ClubControlService } from './club-control.service';

/**
 * O resumo de segunda-feira para cada coordenador, com os clubinhos dele.
 *
 * O levantamento da semana é feito **uma vez** e distribuído: cada coordenador
 * recebe o recorte dos seus clubinhos. Perguntar por coordenador multiplicaria
 * a varredura, que já custa quatro consultas por clubinho.
 *
 * Coordenador sem pendência nenhuma também recebe — o resumo é o retrato da
 * semana, e "tudo em dia" é uma informação que ele quer ter na segunda de
 * manhã, não um silêncio ambíguo.
 */
@Injectable()
export class NotifyCoordinatorSummaryService {
  private readonly logger = new Logger(NotifyCoordinatorSummaryService.name);

  constructor(
    private readonly clubControlService: ClubControlService,
    private readonly resolvePagelaWeekService: ResolvePagelaWeekService,
    private readonly getCoordinatorProfilesService: GetCoordinatorProfilesService,
    private readonly getUsersService: GetUsersService,
    private readonly emailService: EmailService,
    private readonly siteUrlService: SiteUrlService,
  ) {}

  /** Envia o resumo da semana que contém `reference`. Devolve quantos saíram. */
  async notifyForWeekOf(reference: Date): Promise<number> {
    const week = await this.resolvePagelaWeekService.resolve(
      toDateOnly(reference),
      false,
    );

    if (!week) {
      this.logger.log('Semana fora do período letivo: nenhum resumo enviado.');
      return 0;
    }

    const coordinators =
      await this.getCoordinatorProfilesService.findAllActiveWithClubs();

    if (coordinators.length === 0) {
      this.logger.log(
        'Nenhum coordenador em atividade: nenhum resumo enviado.',
      );
      return 0;
    }

    const pendencies = await this.clubControlService.listClubsWithMissingPagela(
      week.year,
      week.week,
    );
    const pendencyByClub = new Map(
      pendencies.map((pendency) => [pendency.clubId, pendency]),
    );

    // Quem se descadastrou ou teve a conta suspensa entre a consulta e agora
    // fica de fora: a régua de elegibilidade é sempre a do módulo de usuário.
    const eligible = await this.getUsersService.findNoticeRecipientsByIds(
      coordinators
        .map((coordinator) => coordinator.user?.id)
        .filter((id): id is string => Boolean(id)),
    );
    const recipientById = new Map(
      eligible.map((person) => [person.id, person]),
    );

    let sent = 0;
    for (const coordinator of coordinators) {
      const recipient = coordinator.user?.id
        ? recipientById.get(coordinator.user.id)
        : undefined;
      if (!recipient) continue;

      const clubs = coordinator.clubs ?? [];
      const pending = clubs
        .map((club) => pendencyByClub.get(club.id))
        .filter((pendency): pendency is ClubWeekPendency => Boolean(pendency));

      try {
        await this.emailService.sendCoordinatorWeeklySummary(recipient, {
          recipientName: recipient.name,
          academicWeek: week.week,
          academicYear: week.year,
          clubs: pending.map(toSummaryClub),
          clubsOk: clubs.length - pending.length,
          panelLink: this.siteUrlService.buildUrl(CLUB_CONTROL_PATHS.control),
        });
        sent += 1;
      } catch (error: unknown) {
        // Só o id do perfil vai para o log: nome e e-mail, nunca.
        this.logger.error(
          `Falha ao enviar o resumo ao coordenador ${coordinator.id}.`,
          error instanceof Error ? error.stack : undefined,
        );
      }
    }

    this.logger.log(
      `Semana ${week.week}/${week.year}: resumo enviado a ${sent} de ${coordinators.length} coordenador(es).`,
    );

    return sent;
  }
}

/** A pendência no formato de uma linha do resumo. */
function toSummaryClub(pendency: ClubWeekPendency): CoordinatorSummaryClub {
  return {
    clubNumber: pendency.clubNumber,
    status: clubWeekStatusLabel(pendency.status),
    totalChildren: pendency.totalChildren,
    withPagela: pendency.withPagela,
    missing: pendency.missing.length,
  };
}
