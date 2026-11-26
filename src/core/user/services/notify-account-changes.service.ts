import { Injectable, Logger } from '@nestjs/common';

import { UserRole } from 'src/core/auth/auth.types';
import { PASSWORD_SETUP_TTL_HOURS } from 'src/core/auth/constants';
import { EmailService } from 'src/shared/email';
import { SiteUrlService } from 'src/shared/site-url';

import { USER_EMAIL_PATHS } from '../constants';
import { UserEntity } from '../entities/user.entity';
import { roleLabel, toEmailRecipient } from '../utils';

/**
 * Os avisos que a pessoa recebe quando mexem na conta dela.
 *
 * Existe um serviço só para isso, e não uma injeção de `EmailService` em cada
 * operação, por dois motivos: os cinco serviços de conta passariam a repetir o
 * mesmo `try/catch` de envio em segundo plano, e a decisão de *o que* contar à
 * pessoa ficaria espalhada entre `create`, `update` e `delete`.
 *
 * Segue o padrão de `AnnounceWeekMaterialService`: cada método `...InBackground`
 * dispara sem bloquear quem chamou e sem propagar erro. A alteração na conta já
 * terminou quando o aviso começa — e uma falha no servidor de e-mail não pode
 * desfazer uma aprovação de cadastro nem reverter uma troca de senha.
 */
@Injectable()
export class NotifyAccountChangesService {
  private readonly logger = new Logger(NotifyAccountChangesService.name);

  constructor(
    private readonly emailService: EmailService,
    private readonly siteUrlService: SiteUrlService,
  ) {}

  /** Dispara sem bloquear e registra a falha, que nunca sobe. */
  private inBackground(what: string, send: () => Promise<unknown>): void {
    void send().catch((error: unknown) => {
      // O identificador é o suficiente: e-mail e nome não vão para o log.
      this.logger.error(
        `Falha ao enviar o aviso de ${what}.`,
        error instanceof Error ? error.stack : undefined,
      );
    });
  }

  /** A senha da conta acabou de mudar pelo painel. */
  passwordChangedInBackground(user: UserEntity): void {
    this.inBackground('senha alterada', () =>
      this.emailService.sendPasswordChanged(toEmailRecipient(user), {
        recipientName: user.name,
        loginLink: this.siteUrlService.buildUrl(USER_EMAIL_PATHS.login),
      }),
    );
  }

  /**
   * O endereço de login mudou — o aviso vai para o **antigo**.
   *
   * É o único caso em que o destinatário não é mais o e-mail da conta, e é
   * justamente esse o ponto: quem trocou o endereço com uma sessão roubada
   * passa a receber tudo, e este aviso é a única coisa que ainda chega a quem é
   * dono da conta.
   */
  emailAddressChangedInBackground(
    previousEmail: string,
    recipientName: string,
    newEmail: string,
  ): void {
    this.inBackground('troca de e-mail', () =>
      this.emailService.sendEmailAddressChanged(previousEmail, {
        recipientName,
        newEmail,
        changedAt: new Date(),
        supportUrl: this.siteUrlService.buildUrl(USER_EMAIL_PATHS.contact),
      }),
    );
  }

  /** O pré-cadastro foi liberado. */
  accountApprovedInBackground(user: UserEntity): void {
    this.inBackground('cadastro aprovado', () =>
      this.emailService.sendAccountApproved(toEmailRecipient(user), {
        recipientName: user.name,
        loginLink: this.siteUrlService.buildUrl(USER_EMAIL_PATHS.login),
      }),
    );
  }

  /** O papel mudou, e com ele o vínculo com o clubinho. */
  roleChangedInBackground(user: UserEntity, previousRole: UserRole): void {
    this.inBackground('mudança de papel', () =>
      this.emailService.sendRoleChanged(toEmailRecipient(user), {
        recipientName: user.name,
        previousRole: roleLabel(previousRole),
        currentRole: roleLabel(user.role),
        loginLink: this.siteUrlService.buildUrl(USER_EMAIL_PATHS.login),
      }),
    );
  }

  /** O acesso foi suspenso. */
  accountDeactivatedInBackground(user: UserEntity): void {
    this.inBackground('conta desativada', () =>
      this.emailService.sendAccountDeactivated(toEmailRecipient(user), {
        recipientName: user.name,
      }),
    );
  }

  /**
   * A conta foi encerrada.
   *
   * Recebe endereço e nome soltos porque a linha do usuário já não existe: a
   * exclusão é física, e quem chama precisa ter guardado os dois antes de
   * apagar.
   */
  accountDeletedInBackground(email: string, recipientName: string): void {
    this.inBackground('conta excluída', () =>
      this.emailService.sendAccountDeleted(email, { recipientName }),
    );
  }

  /** A coordenação criou a conta; o link deixa a pessoa definir a senha. */
  accountCreatedInBackground(
    user: UserEntity,
    passwordSetupLink: string,
  ): void {
    this.inBackground('conta criada', () =>
      this.emailService.sendAccountCreatedByAdmin(toEmailRecipient(user), {
        recipientName: user.name,
        role: roleLabel(user.role),
        passwordSetupLink,
        validityHours: PASSWORD_SETUP_TTL_HOURS,
      }),
    );
  }
}
