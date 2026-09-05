import { Injectable, Logger } from '@nestjs/common';

import { GetUsersService } from 'src/core/user/services/get-user.service';
import { EmailService } from 'src/shared/email';
import { SiteUrlService } from 'src/shared/site-url';

import { DocumentEntity } from '../entities/document.entity';

/**
 * Avisa a base quando um documento entra na Área do Professor.
 *
 * A rota de um documento nasce fechada (`public: false`), então o link do
 * e-mail só abre para quem tem sessão — o template diz isso em vez de deixar a
 * pessoa bater numa tela de login sem entender por quê.
 */
@Injectable()
export class AnnounceDocumentService {
  private readonly logger = new Logger(AnnounceDocumentService.name);

  constructor(
    private readonly emailService: EmailService,
    private readonly getUsersService: GetUsersService,
    private readonly siteUrlService: SiteUrlService,
  ) {}

  /** Dispara sem bloquear quem chamou e sem propagar erro. */
  announceInBackground(document: DocumentEntity): void {
    void this.announce(document).catch((error: unknown) => {
      this.logger.error(
        `Falha ao avisar sobre o documento ${document.id}.`,
        error instanceof Error ? error.stack : undefined,
      );
    });
  }

  async announce(document: DocumentEntity): Promise<void> {
    const path = document.route?.path;

    if (!path) {
      this.logger.warn(`Documento ${document.id} sem rota: aviso não enviado.`);
      return;
    }

    const recipients = await this.getUsersService.findActiveRecipients();

    await this.emailService.sendDocumentPublished(recipients, {
      name: document.name,
      description: document.description ?? undefined,
      documentLink: this.siteUrlService.buildUrl(path),
    });
  }
}
