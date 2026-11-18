import { Injectable, Logger } from '@nestjs/common';

import { GetClubRecipientsService } from 'src/modules/clubs/services/get-club-recipients.service';
import { ResolvePagelaWeekService } from 'src/modules/pagelas/services/resolve-pagela-week.service';
import { EmailService } from 'src/shared/email';
import { SiteUrlService } from 'src/shared/site-url';

import { CLUB_CONTROL_PATHS } from '../constants';
import { ClubWeekPendency } from '../types';
import { toDateOnly } from '../utils';
import { ClubControlService } from './club-control.service';

/**
 * O lembrete de domingo: as pagelas que ficaram faltando na semana que fechou.
 *
 * Vai para os professores do clubinho e para o coordenador dele — quem pode
 * resolver a pendência —, e não para a base inteira. Um clubinho sem nenhum
 * destinatário elegível é registrado e pulado: não existe a quem cobrar.
 *
 * A semana de referência é a de ontem, sábado. É a última que pôde ter
 * clubinho: domingo nunca é dia de reunião, então no domingo de manhã a semana
 * anterior está fechada e nenhuma pagela dela ainda vai chegar a tempo.
 */
@Injectable()
export class NotifyMissingPagelaService {
  private readonly logger = new Logger(NotifyMissingPagelaService.name);

  constructor(
    private readonly clubControlService: ClubControlService,
    private readonly resolvePagelaWeekService: ResolvePagelaWeekService,
    private readonly getClubRecipientsService: GetClubRecipientsService,
    private readonly emailService: EmailService,
    private readonly siteUrlService: SiteUrlService,
  ) {}

  /**
   * Avisa os clubinhos que fecharam a semana com pagela faltando.
   *
   * `reference` é a data de um dia daquela semana — o job passa o sábado.
   * Devolve quantos clubinhos foram avisados, para o log do agendador dizer
   * algo além de "terminou".
   */
  async notifyForWeekOf(reference: Date): Promise<number> {
    const week = await this.resolvePagelaWeekService.resolve(
      toDateOnly(reference),
      false,
    );

    // Fora do período letivo não há pagela a cobrar — férias, recesso, o
    // intervalo entre um ano letivo e o seguinte.
    if (!week) {
      this.logger.log(
        'Semana fora do período letivo: nenhum lembrete enviado.',
      );
      return 0;
    }

    const pendencies = await this.clubControlService.listClubsWithMissingPagela(
      week.year,
      week.week,
    );

    if (pendencies.length === 0) {
      this.logger.log(
        `Semana ${week.week}/${week.year}: nenhum clubinho com pagela faltando.`,
      );
      return 0;
    }

    const recipientsByClub = await this.getClubRecipientsService.forClubs(
      pendencies.map((pendency) => pendency.clubId),
    );

    let notified = 0;
    for (const pendency of pendencies) {
      const club = recipientsByClub.get(pendency.clubId);
      const recipients = [
        ...(club?.teachers ?? []),
        ...(club?.coordinator ? [club.coordinator] : []),
      ];

      if (recipients.length === 0) {
        this.logger.warn(
          `Clubinho ${pendency.clubNumber} sem destinatário elegível: lembrete não enviado.`,
        );
        continue;
      }

      // Uma falha isolada não interrompe os demais clubinhos: o lembrete de um
      // não depende do outro, e o domingo seguinte é daqui a uma semana.
      try {
        await this.send(pendency, recipients, week.year, week.week);
        notified += 1;
      } catch (error: unknown) {
        this.logger.error(
          `Falha ao avisar o clubinho ${pendency.clubNumber}.`,
          error instanceof Error ? error.stack : undefined,
        );
      }
    }

    this.logger.log(
      `Semana ${week.week}/${week.year}: ${notified} de ${pendencies.length} clubinho(s) avisado(s).`,
    );

    return notified;
  }

  private async send(
    pendency: ClubWeekPendency,
    recipients: Parameters<EmailService['sendMissingPagelaReminder']>[0],
    year: number,
    week: number,
  ): Promise<void> {
    await this.emailService.sendMissingPagelaReminder(recipients, {
      clubNumber: pendency.clubNumber,
      academicWeek: week,
      academicYear: year,
      expectedDate: pendency.expectedDate,
      totalChildren: pendency.totalChildren,
      withPagela: pendency.withPagela,
      missing: pendency.missing,
      pagelasLink: this.siteUrlService.buildUrl(CLUB_CONTROL_PATHS.pagelas),
    });
  }
}
