import { Injectable, Logger } from '@nestjs/common';
import { SmtpService } from 'src/shared/providers/smtp/smtp.service';
import { SiteUrlService } from 'src/shared/site-url/site-url.service';
import {
  BulkEmailResult,
  EmailRecipient,
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
import { UNSUBSCRIBE_PATH } from './constants';
import { UnsubscribeTokenService } from './unsubscribe-token.service';

/**
 * Único ponto de disparo de e-mail da aplicação: um método por e-mail, cada um
 * montando o conteúdo pelo template correspondente e entregando ao transporte.
 * Nenhum caso de uso monta assunto ou HTML por conta própria.
 */
@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);

  constructor(
    private readonly smtpService: SmtpService,
    private readonly siteUrlService: SiteUrlService,
    private readonly unsubscribeTokenService: UnsubscribeTokenService,
  ) {}

  /**
   * O link do rodapé, assinado para quem vai receber.
   *
   * Aponta para uma página do site, e não para a API: um `GET` que já cancela
   * seria disparado pelos leitores de link que os provedores rodam antes de a
   * pessoa abrir o e-mail, descadastrando quem nunca clicou.
   */
  private unsubscribeUrlFor(recipient: EmailRecipient): string {
    const token = this.unsubscribeTokenService.create(recipient.id);
    const base = this.siteUrlService.baseUrl;

    return `${base}${UNSUBSCRIBE_PATH}?token=${encodeURIComponent(token)}`;
  }

  async sendPasswordRecovery(
    recipient: EmailRecipient,
    data: PasswordRecoveryEmailData,
  ): Promise<void> {
    await this.send(
      recipient.email,
      passwordRecoveryEmail({
        ...data,
        unsubscribeUrl: this.unsubscribeUrlFor(recipient),
      }),
    );
  }

  async sendPasswordChanged(
    recipient: EmailRecipient,
    data: PasswordChangedEmailData,
  ): Promise<void> {
    await this.send(
      recipient.email,
      passwordChangedEmail({
        ...data,
        unsubscribeUrl: this.unsubscribeUrlFor(recipient),
      }),
    );
  }

  async sendEmailVerification(
    recipient: EmailRecipient,
    data: EmailVerificationEmailData,
  ): Promise<void> {
    await this.send(
      recipient.email,
      emailVerificationEmail({
        ...data,
        unsubscribeUrl: this.unsubscribeUrlFor(recipient),
      }),
    );
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
    recipients: EmailRecipient[],
    data: WeekMaterialAnnouncementEmailData,
  ): Promise<BulkEmailResult> {
    return this.sendToEach(recipients, (unsubscribeUrl) =>
      weekMaterialAnnouncementEmail({ ...data, unsubscribeUrl }),
    );
  }

  /** Avisa toda a base sobre um evento novo na agenda. */
  async sendEventCreated(
    recipients: EmailRecipient[],
    data: EventAnnouncementEmailData,
  ): Promise<BulkEmailResult> {
    return this.sendToEach(recipients, (unsubscribeUrl) =>
      eventCreatedEmail({ ...data, unsubscribeUrl }),
    );
  }

  /** Avisa toda a base de que um evento da agenda mudou. */
  async sendEventUpdated(
    recipients: EmailRecipient[],
    data: EventAnnouncementEmailData,
  ): Promise<BulkEmailResult> {
    return this.sendToEach(recipients, (unsubscribeUrl) =>
      eventUpdatedEmail({ ...data, unsubscribeUrl }),
    );
  }

  /** Avisa toda a base de que um evento saiu da agenda. */
  async sendEventCancelled(
    recipients: EmailRecipient[],
    data: EventAnnouncementEmailData,
  ): Promise<BulkEmailResult> {
    return this.sendToEach(recipients, (unsubscribeUrl) =>
      eventCancelledEmail({ ...data, unsubscribeUrl }),
    );
  }

  /**
   * Envia o aviso pessoa a pessoa.
   *
   * Antes ia em lotes com os endereços em cópia oculta, um HTML para muita
   * gente. O rodapé precisa levar o token de quem recebe, e um token só serve
   * para uma pessoa — então cada mensagem é montada para o seu destinatário.
   *
   * Uma falha isolada não interrompe as demais: o retorno diz quantas passaram,
   * e o registro nomeia o quanto falhou sem expor os endereços.
   */
  private async sendToEach(
    recipients: EmailRecipient[],
    buildContent: (unsubscribeUrl: string) => EmailContent,
  ): Promise<BulkEmailResult> {
    const unique = this.uniqueRecipients(recipients);

    const result: BulkEmailResult = {
      recipients: unique.length,
      sent: 0,
      failed: 0,
    };

    if (unique.length === 0) {
      this.logger.warn('Nenhum destinatário para o aviso.');
      return result;
    }

    let subject = '';

    for (const recipient of unique) {
      const content = buildContent(this.unsubscribeUrlFor(recipient));
      subject = content.subject;

      try {
        await this.smtpService.sendMail({ to: recipient.email, ...content });
        result.sent += 1;
      } catch (error: unknown) {
        result.failed += 1;
        this.logger.error(
          `Falha ao enviar "${content.subject}" para um destinatário.`,
          error instanceof Error ? error.stack : undefined,
        );
      }
    }

    this.logger.log(
      `"${subject}": ${result.recipients} destinatário(s), ${result.sent} enviado(s), ${result.failed} com falha.`,
    );

    return result;
  }

  /** Um envio por pessoa, sem endereço repetido. */
  private uniqueRecipients(recipients: EmailRecipient[]): EmailRecipient[] {
    const byEmail = new Map<string, EmailRecipient>();

    for (const recipient of recipients) {
      const email = recipient.email?.trim();
      if (!email) continue;
      if (!byEmail.has(email)) byEmail.set(email, { ...recipient, email });
    }

    return [...byEmail.values()];
  }

  private async send(to: string, content: EmailContent): Promise<void> {
    await this.smtpService.sendMail({ to, ...content });
  }

  /** Destinatários internos do aviso de contato. */
}
