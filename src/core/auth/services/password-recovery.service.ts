import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';
import { GetUsersService } from '../../user/services/get-user.service';
import { UpdateUserService } from '../../user/services/update-user.service';
import { EmailService } from '../../../shared/providers/aws/email.service';
import { SesIdentityService } from '../../../shared/providers/aws/ses-identity.service';
import { EmailTemplateGenerator } from '../../../shared/email-template-generator';
import { ForgotPasswordDto } from '../dto/forgot-password.dto';
import { ResetPasswordDto } from '../dto/reset-password.dto';
import { PasswordResetTokenRepository } from '../repositories/password-reset-token.repository';
import {
  AppNotFoundException,
  AppBusinessException,
  ErrorCode,
} from 'src/shared/exceptions';

@Injectable()
export class PasswordRecoveryService {
  constructor(
    private getUsersService: GetUsersService,
    private updateUserService: UpdateUserService,
    private emailService: EmailService,
    private passwordResetTokenRepo: PasswordResetTokenRepository,
    private sesIdentityService: SesIdentityService,
    private configService: ConfigService,
  ) {}

  async forgotPassword(data: ForgotPasswordDto) {
    const user = await this.getUsersService.findByEmail(data.email);
    if (!user) {
      throw new AppNotFoundException(
        ErrorCode.USER_NOT_FOUND,
        'Email não encontrado',
      );
    }

    const sesCheck =
      await this.sesIdentityService.checkAndResendSesVerification(user.email);

    if (sesCheck.verificationEmailSent || !sesCheck.alreadyVerified) {
      return {
        status: 'VERIFICATION_EMAIL_SENT',
        message:
          'Seu email ainda não foi verificado. Um novo email de verificação foi enviado.',
      };
    }

    const resetToken = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date();
    expiresAt.setMinutes(expiresAt.getMinutes() + 30);

    await this.passwordResetTokenRepo.invalidateTokensForUser(user.id);
    await this.passwordResetTokenRepo.createToken(
      user.id,
      resetToken,
      expiresAt,
    );

    const baseUrl = this.getBaseUrl();
    const resetLink = `${baseUrl}/recuperar-senha/${resetToken}`;

    const emailHtml = EmailTemplateGenerator.generatePasswordRecovery(
      user.name,
      resetLink,
    );

    await this.emailService.sendEmailViaSES(
      user.email,
      'Recuperação de Senha - Clubinhos NIB',
      `Olá ${user.name},\n\nRecebemos uma solicitação para redefinir sua senha.\nClique no link abaixo: \n${resetLink}`,
      emailHtml,
    );

    return {
      status: 'RESET_LINK_SENT',
      message: 'As instruções de recuperação foram enviadas para o seu email.',
    };
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

    const baseUrl = this.getBaseUrl();
    const emailHtml = EmailTemplateGenerator.generatePasswordChanged(
      user.name,
      baseUrl,
    );

    await this.emailService.sendEmailViaSES(
      user.email,
      'Senha Alterada com Sucesso - Clubinhos NIB',
      `Olá ${user.name},\n\nSua senha foi alterada com sucesso.`,
      emailHtml,
    );

    return { message: 'Senha alterada com sucesso.' };
  }

  private getBaseUrl(): string {
    const environment = this.configService.get<string>('ENVIRONMENT');

    switch (environment) {
      case 'local':
        return 'http://localhost:5173';
      case 'staging':
        return 'https://staging.clubinhonib.com';
      case 'production':
        return 'https://clubinhonib.com';
      default:
        return 'http://localhost:5173';
    }
  }
}
