import { Injectable, Logger } from '@nestjs/common';
import { SmtpService } from 'src/shared/providers/smtp/smtp.service';
import {
  BulkEmailResult,
  ContactNotificationEmailData,
  CommentNotificationEmailData,
  IdeaSharedNotificationEmailData,
  ImageSharedNotificationEmailData,
  NewUserRegistrationNotificationEmailData,
  EmailContent,
  EventAnnouncementEmailData,
  EmailVerificationEmailData,
  PasswordChangedEmailData,
  PasswordRecoveryEmailData,
  SiteFeedbackNotificationEmailData,
  WeekMaterialAnnouncementEmailData,
} from './types';
import {
  contactNotificationEmail,
  commentNotificationEmail,
  ideaSharedNotificationEmail,
  imageSharedNotificationEmail,
  newUserRegistrationNotificationEmail,
  emailVerificationEmail,
  passwordChangedEmail,
  passwordRecoveryEmail,
  siteFeedbackNotificationEmail,
  weekMaterialAnnouncementEmail,
  eventCreatedEmail,
  eventUpdatedEmail,
  eventCancelledEmail,
} from './templates';
import { EMAIL_ANNOUNCEMENT_BATCH_SIZE } from './constants';

/**
 * Único ponto de disparo de e-mail da aplicação: um método por e-mail, cada um
 * montando o conteúdo pelo template correspondente e entregando ao transporte.
 * Nenhum caso de uso monta assunto ou HTML por conta própria.
 */
@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);

  constructor(private readonly smtpService: SmtpService) {}

  async sendPasswordRecovery(
    to: string,
    data: PasswordRecoveryEmailData,
  ): Promise<void> {
    await this.send(to, passwordRecoveryEmail(data));
  }

  async sendPasswordChanged(
    to: string,
    data: PasswordChangedEmailData,
  ): Promise<void> {
    await this.send(to, passwordChangedEmail(data));
  }

  async sendEmailVerification(
    to: string,
    data: EmailVerificationEmailData,
  ): Promise<void> {
    await this.send(to, emailVerificationEmail(data));
  }

  /**
   * Avisa a equipe sobre um contato do site. A resposta vai para quem escreveu,
   * e não para o remetente técnico.
   */
  async sendContactNotification(
    recipients: string[],
    data: ContactNotificationEmailData,
  ): Promise<void> {
    const unique = [...new Set(recipients.map((email) => email.trim()))].filter(
      (email) => email.length > 0,
    );

    if (unique.length === 0) {
      this.logger.warn(
        'Nenhum administrador encontrado: aviso de contato não enviado.',
      );
      return;
    }

    await this.smtpService.sendMail({
      to: unique,
      replyTo: data.email,
      ...contactNotificationEmail(data),
    });
  }

  /**
   * Avisa os administradores sobre um novo comentário postado na Área do Professor.
   */
  async sendCommentNotification(
    recipients: string[],
    data: CommentNotificationEmailData,
  ): Promise<void> {
    const unique = [...new Set(recipients.map((email) => email.trim()))].filter(
      (email) => email.length > 0,
    );

    if (unique.length === 0) {
      this.logger.warn(
        'Nenhum administrador encontrado: aviso de comentário não enviado.',
      );
      return;
    }

    await this.smtpService.sendMail({
      to: unique,
      ...commentNotificationEmail(data),
    });
  }

  /**
   * Avisa os administradores sobre uma nova ideia compartilhada no site.
   */
  /**
   * Avisa os administradores sobre uma avaliação recebida no site.
   *
   * Vai no `to`, e não em cópia oculta: é um grupo pequeno e interno, e todos
   * enxergarem quem mais recebeu ajuda a combinar quem responde.
   */
  async sendSiteFeedbackNotification(
    recipients: string[],
    data: SiteFeedbackNotificationEmailData,
  ): Promise<void> {
    const unique = [...new Set(recipients.map((email) => email.trim()))].filter(
      (email) => email.length > 0,
    );

    if (unique.length === 0) {
      this.logger.warn(
        'Nenhum administrador encontrado: aviso de avaliação não enviado.',
      );
      return;
    }

    await this.smtpService.sendMail({
      to: unique,
      // A resposta vai para quem avaliou, quando deixou o e-mail.
      replyTo: data.email,
      ...siteFeedbackNotificationEmail(data),
    });
  }

  async sendIdeaSharedNotification(
    recipients: string[],
    data: IdeaSharedNotificationEmailData,
  ): Promise<void> {
    const unique = [...new Set(recipients.map((email) => email.trim()))].filter(
      (email) => email.length > 0,
    );

    if (unique.length === 0) {
      this.logger.warn(
        'Nenhum administrador encontrado: aviso de ideia compartilhada não enviado.',
      );
      return;
    }

    await this.smtpService.sendMail({
      to: unique,
      replyTo: data.authorEmail,
      ...ideaSharedNotificationEmail(data),
    });
  }

  /**
   * Avisa os administradores sobre novas imagens do Clubinho compartilhadas no site.
   */
  async sendImageSharedNotification(
    recipients: string[],
    data: ImageSharedNotificationEmailData,
  ): Promise<void> {
    const unique = [...new Set(recipients.map((email) => email.trim()))].filter(
      (email) => email.length > 0,
    );

    if (unique.length === 0) {
      this.logger.warn(
        'Nenhum administrador encontrado: aviso de imagens compartilhadas não enviado.',
      );
      return;
    }

    await this.smtpService.sendMail({
      to: unique,
      replyTo: data.authorEmail,
      ...imageSharedNotificationEmail(data),
    });
  }

  /**
   * Avisa os administradores sobre um novo pré-cadastro de usuário no site.
   */
  async sendNewUserRegistrationNotification(
    recipients: string[],
    data: NewUserRegistrationNotificationEmailData,
  ): Promise<void> {
    const unique = [...new Set(recipients.map((email) => email.trim()))].filter(
      (email) => email.length > 0,
    );

    if (unique.length === 0) {
      this.logger.warn(
        'Nenhum administrador encontrado: aviso de novo pré-cadastro não enviado.',
      );
      return;
    }

    await this.smtpService.sendMail({
      to: unique,
      replyTo: data.email,
      ...newUserRegistrationNotificationEmail(data),
    });
  }

  /** Avisa toda a base sobre um novo material da semana. */
  async sendWeekMaterialAnnouncement(
    recipients: string[],
    data: WeekMaterialAnnouncementEmailData,
  ): Promise<BulkEmailResult> {
    return this.sendBulk(recipients, weekMaterialAnnouncementEmail(data));
  }

  /** Avisa toda a base sobre um evento novo na agenda. */
  async sendEventCreated(
    recipients: string[],
    data: EventAnnouncementEmailData,
  ): Promise<BulkEmailResult> {
    return this.sendBulk(recipients, eventCreatedEmail(data));
  }

  /** Avisa toda a base de que um evento da agenda mudou. */
  async sendEventUpdated(
    recipients: string[],
    data: EventAnnouncementEmailData,
  ): Promise<BulkEmailResult> {
    return this.sendBulk(recipients, eventUpdatedEmail(data));
  }

  /** Avisa toda a base de que um evento saiu da agenda. */
  async sendEventCancelled(
    recipients: string[],
    data: EventAnnouncementEmailData,
  ): Promise<BulkEmailResult> {
    return this.sendBulk(recipients, eventCancelledEmail(data));
  }

  /**
   * Envia o mesmo conteúdo para toda a base.
   *
   * Os endereços vão em cópia oculta, em lotes: ninguém vê a lista dos outros e
   * cada mensagem fica dentro do limite de destinatários do provedor. Um lote
   * que falha não interrompe os demais — o retorno diz quantos passaram.
   */
  private async sendBulk(
    recipients: string[],
    content: EmailContent,
  ): Promise<BulkEmailResult> {
    const unique = [...new Set(recipients.map((email) => email.trim()))].filter(
      (email) => email.length > 0,
    );

    const result: BulkEmailResult = {
      recipients: unique.length,
      batchesSent: 0,
      batchesFailed: 0,
    };

    if (unique.length === 0) {
      this.logger.warn(`Nenhum destinatário para "${content.subject}".`);
      return result;
    }

    for (const batch of this.inBatches(unique, EMAIL_ANNOUNCEMENT_BATCH_SIZE)) {
      try {
        await this.smtpService.sendMail({ bcc: batch, ...content });
        result.batchesSent += 1;
      } catch (error: unknown) {
        result.batchesFailed += 1;
        this.logger.error(
          `Lote de "${content.subject}" falhou (${batch.length} destinatários).`,
          error instanceof Error ? error.stack : undefined,
        );
      }
    }

    this.logger.log(
      `"${content.subject}": ${result.recipients} destinatário(s), ${result.batchesSent} lote(s) enviado(s), ${result.batchesFailed} com falha.`,
    );

    return result;
  }

  private *inBatches(items: string[], size: number): Generator<string[]> {
    for (let index = 0; index < items.length; index += size) {
      yield items.slice(index, index + size);
    }
  }

  private async send(to: string, content: EmailContent): Promise<void> {
    await this.smtpService.sendMail({ to, ...content });
  }

  /** Destinatários internos do aviso de contato. */
}
