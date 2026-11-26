import { Injectable, Logger } from '@nestjs/common';

import { GetUsersService } from 'src/core/user/services/get-user.service';
import { EmailService } from 'src/shared/email';
import { SiteUrlService } from 'src/shared/site-url';

import { InformativeEntity } from '../entities/informative.entity';

/**
 * Avisa a base quando um informativo entra no ar.
 *
 * Um informativo existe para ser divulgado, e até aqui ele só aparecia para
 * quem entrava no site por conta própria.
 *
 * Segue o mesmo desenho de `AnnounceWeekMaterialService`: o envio acontece
 * depois de a página estar gravada e nunca dentro da requisição — são muitos
 * destinatários, e o informativo não deixa de existir porque o servidor de
 * e-mail falhou.
 */
@Injectable()
export class AnnounceInformativeService {
  private readonly logger = new Logger(AnnounceInformativeService.name);

  constructor(
    private readonly emailService: EmailService,
    private readonly getUsersService: GetUsersService,
    private readonly siteUrlService: SiteUrlService,
  ) {}

  /** Dispara sem bloquear quem chamou e sem propagar erro. */
  announceInBackground(informative: InformativeEntity): void {
    void this.announce(informative).catch((error: unknown) => {
      this.logger.error(
        `Falha ao avisar sobre o informativo ${informative.id}.`,
        error instanceof Error ? error.stack : undefined,
      );
    });
  }

  async announce(informative: InformativeEntity): Promise<void> {
    const path = informative.route?.path;

    // Sem rota não há link para oferecer, e um aviso sem link não serve.
    if (!path) {
      this.logger.warn(
        `Informativo ${informative.id} sem rota: aviso não enviado.`,
      );
      return;
    }

    const recipients = await this.getUsersService.findActiveRecipients();

    await this.emailService.sendInformativePublished(recipients, {
      title: informative.title,
      description: informative.description,
      informativeLink: this.siteUrlService.buildUrl(path),
    });
  }
}
