import { Injectable, Logger } from '@nestjs/common';
import { EmailService } from 'src/shared/email';
import { EventAnnouncementEmailData } from 'src/shared/email';
import { SiteUrlService } from 'src/shared/site-url';
import { GetUsersService } from 'src/core/user/services/get-user.service';
import { EventEntity } from '../entities/event.entity';
import { EVENT_AGENDA_PATH } from '../constants';

/** O que muda entre os três avisos da agenda. */
type EventChange = 'created' | 'updated' | 'cancelled';

/**
 * Avisa os usuários já validados quando a agenda muda.
 *
 * O envio acontece depois que a alteração está gravada e nunca dentro da
 * requisição: são muitos destinatários, e o evento não deixa de existir porque
 * o servidor de e-mail falhou.
 */
@Injectable()
export class AnnounceEventService {
  private readonly logger = new Logger(AnnounceEventService.name);

  constructor(
    private readonly emailService: EmailService,
    private readonly getUsersService: GetUsersService,
    private readonly siteUrlService: SiteUrlService,
  ) {}

  /**
   * Dispara o aviso sem bloquear quem chamou e sem propagar erro: a alteração
   * na agenda já terminou quando isto começa.
   */
  announceInBackground(change: EventChange, event: EventEntity): void {
    void this.announce(change, event).catch((error: unknown) => {
      this.logger.error(
        `Falha ao avisar sobre o evento ${event.id} (${change}).`,
        error instanceof Error ? error.stack : undefined,
      );
    });
  }

  async announce(change: EventChange, event: EventEntity): Promise<void> {
    const recipients = await this.getUsersService.findActiveRecipients();

    // Eventos não têm página própria: o link leva para a agenda.
    const data: EventAnnouncementEmailData = {
      title: event.title,
      date: event.date,
      location: event.location,
      description: event.description,
      agendaLink: this.siteUrlService.buildUrl(EVENT_AGENDA_PATH),
    };

    if (change === 'created') {
      await this.emailService.sendEventCreated(recipients, data);
      return;
    }

    if (change === 'updated') {
      await this.emailService.sendEventUpdated(recipients, data);
      return;
    }

    await this.emailService.sendEventCancelled(recipients, data);
  }
}
