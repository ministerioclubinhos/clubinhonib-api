import { Injectable, Logger } from '@nestjs/common';
import { EmailService } from 'src/shared/email';
import { SiteUrlService } from 'src/shared/site-url';
import { GetUsersService } from 'src/core/user/services/get-user.service';
import { WeekMaterialsPageEntity } from '../entities/week-material-page.entity';

/**
 * Avisa os usuários já validados quando um material da semana entra no ar.
 *
 * O envio acontece depois que a página está gravada e nunca dentro da
 * requisição: são muitos destinatários, e o material não deixa de existir
 * porque o servidor de e-mail falhou.
 */
@Injectable()
export class AnnounceWeekMaterialService {
  private readonly logger = new Logger(AnnounceWeekMaterialService.name);

  constructor(
    private readonly emailService: EmailService,
    private readonly getUsersService: GetUsersService,
    private readonly siteUrlService: SiteUrlService,
  ) {}

  /**
   * Dispara o aviso sem bloquear quem chamou e sem propagar erro: a criação da
   * página já terminou quando isto começa.
   */
  announceInBackground(page: WeekMaterialsPageEntity): void {
    void this.announce(page).catch((error: unknown) => {
      this.logger.error(
        `Falha ao avisar sobre o material ${page.id}.`,
        error instanceof Error ? error.stack : undefined,
      );
    });
  }

  async announce(page: WeekMaterialsPageEntity): Promise<void> {
    const path = page.route?.path;

    // Sem rota não há link para oferecer, e um aviso sem link não serve.
    if (!path) {
      this.logger.warn(`Material ${page.id} sem rota: aviso não enviado.`);
      return;
    }

    const recipients = await this.getUsersService.findActiveRecipients();

    await this.emailService.sendWeekMaterialAnnouncement(
      recipients.map((recipient) => recipient.email),
      {
        title: page.title,
        subtitle: page.subtitle,
        description: page.description,
        materialLink: this.siteUrlService.buildUrl(path),
      },
    );
  }
}
