import { Injectable, Logger } from '@nestjs/common';
import * as crypto from 'crypto';
import { GetUsersService } from '../../user/services/get-user.service';
import { UpdateUserService } from '../../user/services/update-user.service';
import { EmailService } from 'src/shared/email';
import { ForgotPasswordDto } from '../dto/forgot-password.dto';
import { ResetPasswordDto } from '../dto/reset-password.dto';
import { PasswordResetTokenRepository } from '../repositories/password-reset-token.repository';
import { SiteUrlService } from 'src/shared/site-url';
import {
  AUTH_EMAIL_PATHS,
  AUTH_TOKEN_BYTES,
  PASSWORD_RESET_TTL_MINUTES,
} from '../constants';
import { AppBusinessException, ErrorCode } from 'src/shared/exceptions';

/**
 * A recuperação responde sempre isto, com ou sem conta correspondente.
 */
const GENERIC_FORGOT_PASSWORD_RESPONSE = {
  status: 'RESET_LINK_SENT',
  message:
    'Se houver uma conta com esse e-mail, as instruções de recuperação foram enviadas.',
} as const;

@Injectable()
export class PasswordRecoveryService {
  private readonly logger = new Logger(PasswordRecoveryService.name);

  constructor(
    private readonly getUsersService: GetUsersService,
    private readonly updateUserService: UpdateUserService,
    private readonly emailService: EmailService,
    private readonly passwordResetTokenRepo: PasswordResetTokenRepository,
    private readonly siteUrlService: SiteUrlService,
  ) {}

  /**
   * Sempre responde a mesma coisa, exista ou não a conta: uma resposta
   * diferente por e-mail inexistente entrega ao atacante quais endereços estão
   * cadastrados.
   */
  async forgotPassword(data: ForgotPasswordDto) {
    const user = await this.getUsersService.findByEmail(data.email);

    if (!user) {
      this.logger.warn('Recuperação pedida para e-mail sem cadastro.');
      return GENERIC_FORGOT_PASSWORD_RESPONSE;
    }

    const resetToken = crypto.randomBytes(AUTH_TOKEN_BYTES).toString('hex');
    const expiresAt = new Date();
    expiresAt.setMinutes(expiresAt.getMinutes() + PASSWORD_RESET_TTL_MINUTES);

    await this.passwordResetTokenRepo.invalidateTokensForUser(user.id);
    await this.passwordResetTokenRepo.createToken(
      user.id,
      resetToken,
      expiresAt,
    );

    await this.emailService.sendPasswordRecovery(
      { id: user.id, name: user.name, email: user.email },
      {
        recipientName: user.name,
        resetLink: this.siteUrlService.buildUrl(
          AUTH_EMAIL_PATHS.passwordReset,
          resetToken,
        ),
      },
    );

    return GENERIC_FORGOT_PASSWORD_RESPONSE;
  }

  async validateResetToken(token: string) {
    const validToken = await this.passwordResetTokenRepo.findValidToken(token);
    if (!validToken) {
      throw new AppBusinessException(
        ErrorCode.RECOVERY_CODE_EXPIRED,
        'Token inválido ou expirado',
      );
    }
    return { valid: true, email: validToken.user.email };
  }

  async resetPassword(dto: ResetPasswordDto) {
    const validToken = await this.passwordResetTokenRepo.findValidToken(
      dto.token,
    );
    if (!validToken) {
      throw new AppBusinessException(
        ErrorCode.RECOVERY_CODE_EXPIRED,
        'Token inválido ou expirado',
      );
    }

    const user = validToken.user;

    await this.updateUserService.update(user.id, {
      password: dto.newPassword,
    });

    await this.passwordResetTokenRepo.deleteToken(dto.token);

    await this.emailService.sendPasswordChanged(
      { id: user.id, name: user.name, email: user.email },
      {
        recipientName: user.name,
        loginLink: this.siteUrlService.baseUrl,
      },
    );

    return { message: 'Senha alterada com sucesso.' };
  }
}
