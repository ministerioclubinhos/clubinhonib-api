import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EmailService } from 'src/shared/email';
import { TwilioService } from '../twilio/twilio.service';
import { ContactEntity } from 'src/modules/contacts/entities/contact.entity';
import { FeedbackCategory } from 'src/modules/feedbacks/entities/feedback-category.enum';
import {
  FEEDBACK_CATEGORY_LABELS,
  FEEDBACK_MAX_RATING,
} from 'src/modules/feedbacks/constants';
import { UserRepository } from 'src/core/user/user.repository';
import { SiteUrlService } from 'src/shared/site-url/site-url.service';
import { ADMIN_PANEL_PATHS } from './constants';

/**
 * Avisa a equipe sobre um contato recebido pelo site, por e-mail e por
 * WhatsApp. Um canal que falha não derruba o outro nem a requisição: o contato
 * já está salvo e continua visível no painel.
 */
@Injectable()
export class NotificationService {
  private readonly logger = new Logger(NotificationService.name);

  constructor(
    private readonly emailService: EmailService,
    private readonly twilioService: TwilioService,
    private readonly configService: ConfigService,
    private readonly userRepository: UserRepository,
    private readonly siteUrlService: SiteUrlService,
  ) {}

  async notifyNewContact(contact: ContactEntity): Promise<void> {
    const results = await Promise.allSettled([
      this.sendContactEmail(contact),
      this.sendContactWhatsApp(contact),
    ]);

    const channels = ['E-mail', 'WhatsApp'];
    results.forEach((result, index) => {
      if (result.status === 'rejected') {
        this.logger.error(
          `Aviso de contato por ${channels[index]} falhou. ID=${contact.id}`,
          result.reason instanceof Error ? result.reason.stack : undefined,
        );
      }
    });
  }

  /**
   * Avisa os administradores sobre uma avaliação recebida em /avaliar-site.
   *
   * Uma falha no envio não derruba a requisição: a avaliação já está salva e
   * continua no painel.
   */
  async notifyNewSiteFeedback(feedback: {
    name: string;
    email?: string;
    rating: number;
    category: FeedbackCategory;
    comment: string;
    createdAt?: Date;
  }): Promise<void> {
    try {
      const adminEmails = await this.userRepository.findAdminEmails();

      await this.emailService.sendSiteFeedbackNotification(adminEmails, {
        name: feedback.name,
        email: feedback.email,
        rating: feedback.rating,
        maxRating: FEEDBACK_MAX_RATING,
        category: FEEDBACK_CATEGORY_LABELS[feedback.category],
        comment: feedback.comment,
        receivedAt: feedback.createdAt ?? new Date(),
        panelUrl: this.siteUrlService.buildUrl(ADMIN_PANEL_PATHS.feedbacks),
      });
    } catch (error: unknown) {
      this.logger.error(
        'Aviso de nova avaliação do site falhou.',
        error instanceof Error ? error.stack : undefined,
      );
    }
  }

  async notifyNewIdeaShared(
    section: { title: string; description?: string; createdAt?: Date },
    author?: { email?: string },
  ): Promise<void> {
    try {
      const adminEmails = await this.userRepository.findAdminEmails();
      let authorName: string | undefined;

      if (author?.email) {
        const user = await this.userRepository.findByEmail(author.email);
        if (user) {
          authorName = user.name;
        }
      }

      await this.emailService.sendIdeaSharedNotification(adminEmails, {
        title: section.title,
        description: section.description,
        authorName,
        authorEmail: author?.email,
        sharedAt: section.createdAt ?? new Date(),
      });
    } catch (error: unknown) {
      this.logger.error(
        `Aviso de nova ideia compartilhada falhou. Título="${section.title}"`,
        error instanceof Error ? error.stack : undefined,
      );
    }
  }

  async notifyNewImageShared(
    section: { caption: string; description?: string; createdAt?: Date },
    author?: { email?: string },
  ): Promise<void> {
    try {
      const adminEmails = await this.userRepository.findAdminEmails();
      let authorName: string | undefined;

      if (author?.email) {
        const user = await this.userRepository.findByEmail(author.email);
        if (user) {
          authorName = user.name;
        }
      }

      await this.emailService.sendImageSharedNotification(adminEmails, {
        caption: section.caption,
        description: section.description,
        authorName,
        authorEmail: author?.email,
        sharedAt: section.createdAt ?? new Date(),
      });
    } catch (error: unknown) {
      this.logger.error(
        `Aviso de novas imagens compartilhadas falhou. Legenda="${section.caption}"`,
        error instanceof Error ? error.stack : undefined,
      );
    }
  }

  async notifyNewUserRegistration(
    user: { name?: string; email: string; createdAt?: Date },
    provider: 'google' | 'normal',
  ): Promise<void> {
    try {
      const adminEmails = await this.userRepository.findAdminEmails();

      await this.emailService.sendNewUserRegistrationNotification(adminEmails, {
        name: user.name ?? '',
        email: user.email,
        provider,
        registeredAt: user.createdAt ?? new Date(),
      });
    } catch (error: unknown) {
      this.logger.error(
        `Aviso de novo pré-cadastro de usuário falhou. Email="${user.email}"`,
        error instanceof Error ? error.stack : undefined,
      );
    }
  }

  async notifyNewComment(comment: {
    id: string;
    name: string;
    comment: string;
    clubinho: string;
    neighborhood: string;
    createdAt?: Date;
  }): Promise<void> {
    try {
      const adminEmails = await this.userRepository.findAdminEmails();
      await this.emailService.sendCommentNotification(adminEmails, {
        name: comment.name,
        comment: comment.comment,
        clubinho: comment.clubinho,
        neighborhood: comment.neighborhood,
        createdAt: comment.createdAt ?? new Date(),
        panelUrl: this.siteUrlService.buildUrl(ADMIN_PANEL_PATHS.comments),
      });
    } catch (error: unknown) {
      this.logger.error(
        `Aviso de novo comentário falhou. ID=${comment.id}`,
        error instanceof Error ? error.stack : undefined,
      );
    }
  }

  private async sendContactEmail(contact: ContactEntity): Promise<void> {
    const adminEmails = await this.userRepository.findAdminEmails();
    await this.emailService.sendContactNotification(adminEmails, {
      name: contact.name,
      email: contact.email,
      phone: contact.phone,
      message: contact.message,
      receivedAt: contact.createdAt ?? new Date(),
      panelUrl: this.siteUrlService.buildUrl(ADMIN_PANEL_PATHS.contacts),
    });
  }

  private async sendContactWhatsApp(contact: ContactEntity): Promise<void> {
    const whatsappTo = this.configService.get<string>('TWILIO_WHATSAPP_TO');

    if (!whatsappTo) {
      this.logger.warn(
        'TWILIO_WHATSAPP_TO não configurado, WhatsApp ignorado.',
      );
      return;
    }

    await this.twilioService.sendWhatsApp(
      whatsappTo,
      this.buildWhatsAppMessage(contact),
    );
  }

  private buildWhatsAppMessage(contact: ContactEntity): string {
    return `
*Novo contato recebido via site Clubinhos NIB!*

*Nome:* ${contact.name}
*E-mail:* ${contact.email}
*Telefone:* ${contact.phone}

*Mensagem:*
${contact.message}
    `.trim();
  }
}
