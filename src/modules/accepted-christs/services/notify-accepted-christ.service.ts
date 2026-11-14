import { Injectable, Logger } from '@nestjs/common';

import { ChildEntity } from 'src/modules/children/entities/child.entity';
import { GetClubRecipientsService } from 'src/modules/clubs/services/get-club-recipients.service';
import { EmailService } from 'src/shared/email';
import { SiteUrlService } from 'src/shared/site-url';

import { ACCEPTED_CHRIST_PANEL_PATH } from '../constants';
import { AcceptedChristEntity } from '../entities/accepted-christ.entity';
import { decisionLabel } from '../utils';

/**
 * Avisa o clubinho da criança quando uma decisão é registrada.
 *
 * Vai para o coordenador do clubinho e para os professores dele — quem
 * acompanha aquela criança toda semana e vai continuar acompanhando. É por isso
 * que o nome dela pode aparecer no corpo: não é divulgação, é o aviso chegando
 * a quem já a conhece.
 *
 * A observação de quem registrou (`notes`) **não** vai junto. Ela é escrita
 * para o registro, muitas vezes com detalhes da conversa, e a lista de
 * destinatários é maior do que quem escreveu tinha em mente.
 */
@Injectable()
export class NotifyAcceptedChristService {
  private readonly logger = new Logger(NotifyAcceptedChristService.name);

  constructor(
    private readonly getClubRecipientsService: GetClubRecipientsService,
    private readonly emailService: EmailService,
    private readonly siteUrlService: SiteUrlService,
  ) {}

  /** Dispara sem bloquear quem chamou e sem propagar erro. */
  notifyInBackground(decision: AcceptedChristEntity, child: ChildEntity): void {
    void this.notify(decision, child).catch((error: unknown) => {
      // Só o id do registro: nome de criança não entra no log.
      this.logger.error(
        `Falha ao avisar sobre a decisão ${decision.id}.`,
        error instanceof Error ? error.stack : undefined,
      );
    });
  }

  async notify(
    decision: AcceptedChristEntity,
    child: ChildEntity,
  ): Promise<void> {
    const club = child.club;

    // O vínculo com o clubinho é anulável: uma criança sem clube não tem a
    // quem avisar, e isso não é erro.
    if (!club) {
      this.logger.warn(
        `Decisão ${decision.id} de criança sem clubinho: aviso não enviado.`,
      );
      return;
    }

    const recipients = await this.getClubRecipientsService.forClub(club.id);
    const people = [
      ...recipients.teachers,
      ...(recipients.coordinator ? [recipients.coordinator] : []),
    ];

    if (people.length === 0) {
      this.logger.warn(
        `Clubinho ${recipients.clubNumber} sem destinatário elegível: aviso da decisão não enviado.`,
      );
      return;
    }

    await this.emailService.sendAcceptedChristRegistered(people, {
      childName: child.name,
      clubNumber: recipients.clubNumber,
      decision: decisionLabel(decision.decision),
      registeredAt: decision.createdAt,
      panelLink: this.siteUrlService.buildUrl(ACCEPTED_CHRIST_PANEL_PATH),
    });
  }
}
