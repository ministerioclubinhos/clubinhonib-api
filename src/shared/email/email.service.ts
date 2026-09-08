import { Injectable, Logger } from '@nestjs/common';
import { SmtpService } from 'src/shared/providers/smtp/smtp.service';
import { SiteUrlService } from 'src/shared/site-url/site-url.service';
import { GetFeatureFlagsService } from 'src/core/feature-flags/services/get-feature-flags.service';

import {
  BulkEmailResult,
  EmailRecipient,
  ContactNotificationEmailData,
  CommentNotificationEmailData,
  IdeaSharedNotificationEmailData,
  ImageSharedNotificationEmailData,
  NewUserRegistrationNotificationEmailData,
  EmailContent,
  EmailNotification,
  EventAnnouncementEmailData,
  EmailVerificationEmailData,
  PasswordChangedEmailData,
  PasswordRecoveryEmailData,
  SiteFeedbackNotificationEmailData,
  WeekMaterialAnnouncementEmailData,
  EmailAddressChangedEmailData,
  AccountApprovedEmailData,
  RoleChangedEmailData,
  AccountDeactivatedEmailData,
  AccountDeletedEmailData,
  AccountCreatedByAdminEmailData,
  InformativePublishedEmailData,
  DocumentPublishedEmailData,
  ClubDayCancelledEmailData,
  ContactReceiptEmailData,
  MissingPagelaReminderEmailData,
  CoordinatorWeeklySummaryEmailData,
  AcceptedChristRegisteredEmailData,
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
  emailAddressChangedEmail,
  accountApprovedEmail,
  roleChangedEmail,
  accountDeactivatedEmail,
  accountDeletedEmail,
  accountCreatedByAdminEmail,
  informativePublishedEmail,
  documentPublishedEmail,
  clubDayCancelledEmail,
  contactReceiptEmail,
  missingPagelaReminderEmail,
  coordinatorWeeklySummaryEmail,
  acceptedChristRegisteredEmail,
  weekMaterialAnnouncementEmail,
  eventCreatedEmail,
  eventUpdatedEmail,
  eventCancelledEmail,
} from './templates';
import {
  EMAIL_NOTIFICATION_FLAGS,
  EMAIL_NOTIFICATIONS_FOR_INACTIVE,
  EMAIL_SEND_WHEN_FLAG_MISSING,
  UNSUBSCRIBE_PATH,
} from './constants';
import { UnsubscribeTokenService } from './unsubscribe-token.service';

/**
 * Único ponto de disparo de e-mail da aplicação: um método por e-mail, cada um
 * montando o conteúdo pelo template correspondente e entregando ao transporte.
 * Nenhum caso de uso monta assunto ou HTML por conta própria.
 *
 * **Toda notificação passa por uma feature flag própria.** A checagem mora aqui
 * de propósito: é o funil por onde todo e-mail passa, então a flag não depende
 * de o caso de uso lembrar de consultá-la. Um método que envie sem passar por
 * `dispatch`/`dispatchBulk` é um envio que ninguém consegue desligar — e o
 * teste de contrato em `email.service.spec.ts` reprova exatamente isso.
 */
@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);

  constructor(
    private readonly smtpService: SmtpService,
    private readonly siteUrlService: SiteUrlService,
    private readonly unsubscribeTokenService: UnsubscribeTokenService,
    private readonly featureFlags: GetFeatureFlagsService,
  ) {}

  /**
   * Se este e-mail pode sair agora.
   *
   * A resposta fica em cache por um minuto no serviço de flags, então desligar
   * um envio no painel leva até esse tempo para valer — o que é aceitável para
   * um interruptor administrativo e evita uma consulta por destinatário.
   */
  private async isNotificationEnabled(
    notification: EmailNotification,
  ): Promise<boolean> {
    const key = EMAIL_NOTIFICATION_FLAGS[notification];
    const enabled = await this.featureFlags.isSwitchedOn(
      key,
      EMAIL_SEND_WHEN_FLAG_MISSING,
    );

    if (!enabled) {
      this.logger.log(`E-mail "${notification}" não enviado: flag desligada.`);
    }

    return enabled;
  }

  /**
   * Envio único: a flag desligada simplesmente não envia.
   *
   * **Nunca lança.** Todo e-mail da aplicação passa por aqui, e nenhum deles é
   * o produto da operação que o disparou: a conta já foi criada, a senha já foi
   * trocada, o material já foi publicado. Deixar a falha subir transformava um
   * limite diário do provedor de e-mail em erro 500 no login e no cadastro,
   * com a operação já concluída do outro lado.
   *
   * O retorno diz se a mensagem chegou a ser entregue ao provedor, para quem
   * precisa contar isso ao usuário — a confirmação de e-mail, por exemplo.
   * Quem ignora o retorno segue em frente, que é o comportamento certo para um
   * aviso.
   */
  private async dispatch(
    notification: EmailNotification,
    recipient: EmailRecipient | null,
    send: () => Promise<void>,
  ): Promise<boolean> {
    if (!this.canReceive(notification, recipient)) return false;
    if (!(await this.isNotificationEnabled(notification))) return false;

    try {
      await send();
      return true;
    } catch (error: unknown) {
      this.logger.error(
        `Falha ao enviar o e-mail "${notification}". A operação que o disparou não é afetada.`,
        error instanceof Error ? error.stack : undefined,
      );
      return false;
    }
  }

  /**
   * Aviso só vai para conta ativa.
   *
   * A exceção é a lista em `EMAIL_NOTIFICATIONS_FOR_INACTIVE`: e-mail de conta
   * e de segurança continua saindo, porque cortá-lo trancaria a pessoa para
   * fora da própria conta — a mesma lógica do descadastro.
   *
   * `recipient` é `null` nos envios endereçados a quem não é usuário da base
   * (a confirmação de contato, a exclusão de conta) e nos envios em massa, cujas
   * listas já chegam filtradas pela régua do `core/user`. Sem situação
   * conhecida não há o que barrar.
   */
  private canReceive(
    notification: EmailNotification,
    recipient: EmailRecipient | null,
  ): boolean {
    if (recipient?.active !== false) return true;
    if (EMAIL_NOTIFICATIONS_FOR_INACTIVE.has(notification)) return true;

    this.logger.log(
      `E-mail "${notification}" não enviado: a conta do destinatário está inativa.`,
    );
    return false;
  }

  /**
   * Envio em massa.
   *
   * Com a flag desligada devolve o resultado vazio, e não os destinatários que
   * teriam recebido: quem chama registra o que foi enviado, e contar como
   * enviado o que ninguém recebeu tornaria o log uma ficção.
   */
  private async dispatchBulk(
    notification: EmailNotification,
    send: () => Promise<BulkEmailResult>,
  ): Promise<BulkEmailResult> {
    if (!(await this.isNotificationEnabled(notification))) {
      return { recipients: 0, sent: 0, failed: 0 };
    }

    // O laço em massa já trata destinatário a destinatário: um endereço
    // recusado entra em `failed` e os outros seguem. O `try` aqui cobre o que
    // acontece **em volta** dele — montar a lista, o próprio laço estourar —
    // pelo mesmo motivo do envio único: nada disso é o produto da operação.
    try {
      return await send();
    } catch (error: unknown) {
      this.logger.error(
        `Falha no envio em massa de "${notification}". A operação que o disparou não é afetada.`,
        error instanceof Error ? error.stack : undefined,
      );
      return { recipients: 0, sent: 0, failed: 0 };
    }
  }

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
    await this.dispatch(
      EmailNotification.PasswordRecovery,
      recipient,
      async () => {
        await this.send(
          recipient.email,
          passwordRecoveryEmail({
            ...data,
            unsubscribeUrl: this.unsubscribeUrlFor(recipient),
          }),
        );
      },
    );
  }

  async sendPasswordChanged(
    recipient: EmailRecipient,
    data: PasswordChangedEmailData,
  ): Promise<void> {
    await this.dispatch(
      EmailNotification.PasswordChanged,
      recipient,
      async () => {
        await this.send(
          recipient.email,
          passwordChangedEmail({
            ...data,
            unsubscribeUrl: this.unsubscribeUrlFor(recipient),
          }),
        );
      },
    );
  }

  /**
   * Devolve se a confirmação chegou a sair.
   *
   * É o único envio cujo resultado o fluxo precisa saber: a tela conta ao
   * usuário se o e-mail foi enviado ou se ele deve pedir o reenvio.
   */
  async sendEmailVerification(
    recipient: EmailRecipient,
    data: EmailVerificationEmailData,
  ): Promise<boolean> {
    return this.dispatch(
      EmailNotification.EmailVerification,
      recipient,
      async () => {
        await this.send(
          recipient.email,
          emailVerificationEmail({
            ...data,
            unsubscribeUrl: this.unsubscribeUrlFor(recipient),
          }),
        );
      },
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
    await this.dispatch(
      EmailNotification.ContactNotification,
      null,
      async () => {
        const unique = [
          ...new Set(recipients.map((email) => email.trim())),
        ].filter((email) => email.length > 0);

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
      },
    );
  }

  /**
   * Avisa os administradores sobre um novo comentário postado na Área do Professor.
   */
  async sendCommentNotification(
    recipients: string[],
    data: CommentNotificationEmailData,
  ): Promise<void> {
    await this.dispatch(
      EmailNotification.CommentNotification,
      null,
      async () => {
        const unique = [
          ...new Set(recipients.map((email) => email.trim())),
        ].filter((email) => email.length > 0);

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
      },
    );
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
    await this.dispatch(
      EmailNotification.SiteFeedbackNotification,
      null,
      async () => {
        const unique = [
          ...new Set(recipients.map((email) => email.trim())),
        ].filter((email) => email.length > 0);

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
      },
    );
  }

  async sendIdeaSharedNotification(
    recipients: string[],
    data: IdeaSharedNotificationEmailData,
  ): Promise<void> {
    await this.dispatch(
      EmailNotification.IdeaSharedNotification,
      null,
      async () => {
        const unique = [
          ...new Set(recipients.map((email) => email.trim())),
        ].filter((email) => email.length > 0);

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
      },
    );
  }

  /**
   * Avisa os administradores sobre novas imagens do Clubinho compartilhadas no site.
   */
  async sendImageSharedNotification(
    recipients: string[],
    data: ImageSharedNotificationEmailData,
  ): Promise<void> {
    await this.dispatch(
      EmailNotification.ImageSharedNotification,
      null,
      async () => {
        const unique = [
          ...new Set(recipients.map((email) => email.trim())),
        ].filter((email) => email.length > 0);

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
      },
    );
  }

  /**
   * Avisa os administradores sobre um novo pré-cadastro de usuário no site.
   */
  async sendNewUserRegistrationNotification(
    recipients: string[],
    data: NewUserRegistrationNotificationEmailData,
  ): Promise<void> {
    await this.dispatch(
      EmailNotification.NewUserRegistrationNotification,
      null,
      async () => {
        const unique = [
          ...new Set(recipients.map((email) => email.trim())),
        ].filter((email) => email.length > 0);

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
      },
    );
  }

  /** Avisa toda a base sobre um novo material da semana. */
  async sendWeekMaterialAnnouncement(
    recipients: EmailRecipient[],
    data: WeekMaterialAnnouncementEmailData,
  ): Promise<BulkEmailResult> {
    return this.dispatchBulk(EmailNotification.WeekMaterialAnnouncement, () =>
      this.sendToEach(recipients, (unsubscribeUrl) =>
        weekMaterialAnnouncementEmail({ ...data, unsubscribeUrl }),
      ),
    );
  }

  /** Avisa toda a base sobre um evento novo na agenda. */
  async sendEventCreated(
    recipients: EmailRecipient[],
    data: EventAnnouncementEmailData,
  ): Promise<BulkEmailResult> {
    return this.dispatchBulk(EmailNotification.EventCreated, () =>
      this.sendToEach(recipients, (unsubscribeUrl) =>
        eventCreatedEmail({ ...data, unsubscribeUrl }),
      ),
    );
  }

  /** Avisa toda a base de que um evento da agenda mudou. */
  async sendEventUpdated(
    recipients: EmailRecipient[],
    data: EventAnnouncementEmailData,
  ): Promise<BulkEmailResult> {
    return this.dispatchBulk(EmailNotification.EventUpdated, () =>
      this.sendToEach(recipients, (unsubscribeUrl) =>
        eventUpdatedEmail({ ...data, unsubscribeUrl }),
      ),
    );
  }

  /** Avisa toda a base de que um evento saiu da agenda. */
  async sendEventCancelled(
    recipients: EmailRecipient[],
    data: EventAnnouncementEmailData,
  ): Promise<BulkEmailResult> {
    return this.dispatchBulk(EmailNotification.EventCancelled, () =>
      this.sendToEach(recipients, (unsubscribeUrl) =>
        eventCancelledEmail({ ...data, unsubscribeUrl }),
      ),
    );
  }

  /* ---------------------------------------------------------------- *
   * Conta e acesso
   * ---------------------------------------------------------------- */

  /**
   * Avisa que o endereço de login mudou — no endereço **antigo**.
   *
   * Recebe o e-mail avulso, e não um `EmailRecipient`, porque o destino já não
   * é o endereço da conta: não há token de descadastro a emitir para ele.
   */
  async sendEmailAddressChanged(
    previousEmail: string,
    data: EmailAddressChangedEmailData,
  ): Promise<void> {
    await this.dispatch(
      EmailNotification.EmailAddressChanged,
      null,
      async () => {
        await this.send(previousEmail, emailAddressChangedEmail(data));
      },
    );
  }

  async sendAccountApproved(
    recipient: EmailRecipient,
    data: AccountApprovedEmailData,
  ): Promise<void> {
    await this.dispatch(
      EmailNotification.AccountApproved,
      recipient,
      async () => {
        await this.send(
          recipient.email,
          accountApprovedEmail({
            ...data,
            unsubscribeUrl: this.unsubscribeUrlFor(recipient),
          }),
        );
      },
    );
  }

  async sendRoleChanged(
    recipient: EmailRecipient,
    data: RoleChangedEmailData,
  ): Promise<void> {
    await this.dispatch(EmailNotification.RoleChanged, recipient, async () => {
      await this.send(
        recipient.email,
        roleChangedEmail({
          ...data,
          unsubscribeUrl: this.unsubscribeUrlFor(recipient),
        }),
      );
    });
  }

  async sendAccountDeactivated(
    recipient: EmailRecipient,
    data: AccountDeactivatedEmailData,
  ): Promise<void> {
    await this.dispatch(
      EmailNotification.AccountDeactivated,
      recipient,
      async () => {
        await this.send(
          recipient.email,
          accountDeactivatedEmail({
            ...data,
            unsubscribeUrl: this.unsubscribeUrlFor(recipient),
          }),
        );
      },
    );
  }

  /**
   * Avisa que a conta foi encerrada.
   *
   * Sem `EmailRecipient` e sem rodapé de descadastro: a linha do usuário já não
   * existe quando este e-mail sai, e um token assinado para um id apagado não
   * levaria a lugar nenhum.
   */
  async sendAccountDeleted(
    email: string,
    data: AccountDeletedEmailData,
  ): Promise<void> {
    await this.dispatch(EmailNotification.AccountDeleted, null, async () => {
      await this.send(email, accountDeletedEmail(data));
    });
  }

  async sendAccountCreatedByAdmin(
    recipient: EmailRecipient,
    data: AccountCreatedByAdminEmailData,
  ): Promise<void> {
    await this.dispatch(
      EmailNotification.AccountCreatedByAdmin,
      recipient,
      async () => {
        await this.send(
          recipient.email,
          accountCreatedByAdminEmail({
            ...data,
            unsubscribeUrl: this.unsubscribeUrlFor(recipient),
          }),
        );
      },
    );
  }

  /* ---------------------------------------------------------------- *
   * Publicações para toda a base
   * ---------------------------------------------------------------- */

  /** Avisa toda a base sobre um informativo publicado. */
  async sendInformativePublished(
    recipients: EmailRecipient[],
    data: InformativePublishedEmailData,
  ): Promise<BulkEmailResult> {
    return this.dispatchBulk(EmailNotification.InformativePublished, () =>
      this.sendToEach(recipients, (unsubscribeUrl) =>
        informativePublishedEmail({ ...data, unsubscribeUrl }),
      ),
    );
  }

  /** Avisa toda a base sobre um documento novo na Área do Professor. */
  async sendDocumentPublished(
    recipients: EmailRecipient[],
    data: DocumentPublishedEmailData,
  ): Promise<BulkEmailResult> {
    return this.dispatchBulk(EmailNotification.DocumentPublished, () =>
      this.sendToEach(recipients, (unsubscribeUrl) =>
        documentPublishedEmail({ ...data, unsubscribeUrl }),
      ),
    );
  }

  /**
   * Avisa toda a base de que uma data não terá Clubinho.
   *
   * Vai para todos, e não só para os clubinhos daquele dia da semana, porque a
   * exceção é global por data: quem coordena vários clubes precisa saber, e um
   * professor que troca de clube também.
   */
  async sendClubDayCancelled(
    recipients: EmailRecipient[],
    data: ClubDayCancelledEmailData,
  ): Promise<BulkEmailResult> {
    return this.dispatchBulk(EmailNotification.ClubDayCancelled, () =>
      this.sendToEach(recipients, (unsubscribeUrl) =>
        clubDayCancelledEmail({ ...data, unsubscribeUrl }),
      ),
    );
  }

  /* ---------------------------------------------------------------- *
   * Confirmação para quem escreveu
   * ---------------------------------------------------------------- */

  /** Confirma, para quem escreveu pelo site, que a mensagem chegou. */
  async sendContactReceipt(
    email: string,
    data: ContactReceiptEmailData,
  ): Promise<void> {
    await this.dispatch(EmailNotification.ContactReceipt, null, async () => {
      await this.send(email, contactReceiptEmail(data));
    });
  }

  /* ---------------------------------------------------------------- *
   * Operacional do clubinho
   * ---------------------------------------------------------------- */

  /** Lembra os professores e o coordenador de um clubinho das pagelas que faltam. */
  async sendMissingPagelaReminder(
    recipients: EmailRecipient[],
    data: MissingPagelaReminderEmailData,
  ): Promise<BulkEmailResult> {
    return this.dispatchBulk(EmailNotification.MissingPagelaReminder, () =>
      this.sendToEach(recipients, (unsubscribeUrl) =>
        missingPagelaReminderEmail({ ...data, unsubscribeUrl }),
      ),
    );
  }

  /** Manda a um coordenador o resumo da semana dos clubinhos dele. */
  async sendCoordinatorWeeklySummary(
    recipient: EmailRecipient,
    data: CoordinatorWeeklySummaryEmailData,
  ): Promise<void> {
    await this.dispatch(
      EmailNotification.CoordinatorWeeklySummary,
      recipient,
      async () => {
        await this.send(
          recipient.email,
          coordinatorWeeklySummaryEmail({
            ...data,
            unsubscribeUrl: this.unsubscribeUrlFor(recipient),
          }),
        );
      },
    );
  }

  /** Avisa o clubinho da criança sobre a decisão registrada. */
  async sendAcceptedChristRegistered(
    recipients: EmailRecipient[],
    data: AcceptedChristRegisteredEmailData,
  ): Promise<BulkEmailResult> {
    return this.dispatchBulk(EmailNotification.AcceptedChristRegistered, () =>
      this.sendToEach(recipients, (unsubscribeUrl) =>
        acceptedChristRegisteredEmail({ ...data, unsubscribeUrl }),
      ),
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
