import { Injectable, Logger } from '@nestjs/common';

import { UnsubscribeTokenService } from 'src/shared/email/unsubscribe-token.service';
import { AppValidationException, ErrorCode } from 'src/shared/exceptions';

import { EmailPreferencesResponseDto } from '../dto/unsubscribe-notices.dto';
import { UserRepository } from '../user.repository';

/**
 * A preferência de recebimento de avisos.
 *
 * Quem chega aqui vem do link no rodapé de um e-mail, sem sessão: o token é a
 * única credencial, e ele só serve para isto.
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
}
