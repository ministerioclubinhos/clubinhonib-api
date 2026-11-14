import { Injectable, Logger } from '@nestjs/common';

import { UnsubscribeTokenService } from 'src/shared/email/unsubscribe-token.service';
import {
  AppNotFoundException,
  AppValidationException,
  ErrorCode,
} from 'src/shared/exceptions';

import { MyEmailPreferencesResponseDto } from '../dto/my-email-preferences.dto';
import { EmailPreferencesResponseDto } from '../dto/unsubscribe-notices.dto';
import { UserRepository } from '../user.repository';
import { toMyEmailPreferences } from '../utils';

/**
 * A preferência de recebimento de avisos.
 *
 * Dois caminhos gravam o mesmo campo (`noticesUnsubscribedAt`): o link no
 * rodapé de um e-mail, sem sessão (o token é a única credencial), e a chave
 * "Receber avisos por e-mail" nas configurações de notificação, com sessão.
 */
@Injectable()
export class UpdateEmailPreferencesService {
  private readonly logger = new Logger(UpdateEmailPreferencesService.name);

  constructor(
    private readonly userRepo: UserRepository,
    private readonly unsubscribeTokenService: UnsubscribeTokenService,
  ) {}

  /**
   * Tira a pessoa da lista de avisos.
   *
   * É idempotente: clicar duas vezes no mesmo link responde a mesma coisa, e
   * não é erro — o segundo clique costuma ser o da dúvida se o primeiro pegou.
   *
   * A resposta é a mesma para token inválido e para usuário inexistente, e não
   * conta se aquele endereço existe na base.
   */
  async unsubscribeFromNotices(
    token: string,
  ): Promise<EmailPreferencesResponseDto> {
    const userId = this.unsubscribeTokenService.verify(token);

    if (!userId) {
      throw new AppValidationException(
        ErrorCode.INVALID_INPUT,
        'Link de descadastro inválido ou incompleto.',
      );
    }

    const user = await this.userRepo.findById(userId);
    if (!user) {
      throw new AppValidationException(
        ErrorCode.INVALID_INPUT,
        'Link de descadastro inválido ou incompleto.',
      );
    }

    if (!user.noticesUnsubscribedAt) {
      await this.userRepo.setNoticesUnsubscribedAt(userId, new Date());
      this.logger.log(`Usuário ${userId} saiu da lista de avisos.`);
    }

    return {
      unsubscribed: true,
      message:
        'Pronto: você não vai mais receber os avisos do Clubinho. ' +
        'E-mails de recuperação de senha e de confirmação de conta continuam ' +
        'chegando, porque respondem a algo que você mesmo pedir.',
    };
  }

  /**
   * A pessoa logada liga ou desliga os avisos por e-mail.
   *
   * Desligar mantém a data da primeira saída (idempotente, como o link);
   * religar limpa a data e a pessoa volta às listas de avisos.
   */
  async updateMine(
    userId: string,
    noticesEnabled: boolean,
  ): Promise<MyEmailPreferencesResponseDto> {
    const user = await this.userRepo.findById(userId);
    if (!user) {
      throw new AppNotFoundException(
        ErrorCode.USER_NOT_FOUND,
        'Usuário não encontrado.',
      );
    }

    const unsubscribedAt = noticesEnabled
      ? null
      : (user.noticesUnsubscribedAt ?? new Date());
    if (unsubscribedAt !== user.noticesUnsubscribedAt) {
      await this.userRepo.setNoticesUnsubscribedAt(userId, unsubscribedAt);
      this.logger.log(
        `Usuário ${userId} ${noticesEnabled ? 'voltou à' : 'saiu da'} lista de avisos pelas configurações.`,
      );
    }
    return toMyEmailPreferences(unsubscribedAt);
  }
}
