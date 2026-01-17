import { BadRequestException, Injectable } from '@nestjs/common';
import * as crypto from 'crypto';
import { GetUsersService } from 'src/core/user/services/get-user.service';
import { UpdateUserService } from 'src/core/user/services/update-user.service';
import { EmailService } from 'src/shared/providers/aws/email.service';
import { SesIdentityService } from 'src/shared/providers/aws/ses-identity.service';
import { EmailTemplateGenerator } from 'src/shared/email-template-generator';
import { ForgotPasswordDto } from '../dto/forgot-password.dto';
import { ResetPasswordDto } from '../dto/reset-password.dto';
import { PasswordResetTokenRepository } from '../repositories/password-reset-token.repository';

@Injectable()
export class PasswordRecoveryService {
    constructor(
        private getUsersService: GetUsersService,
        private updateUserService: UpdateUserService,
        private emailService: EmailService,
        private passwordResetTokenRepo: PasswordResetTokenRepository,
        private sesIdentityService: SesIdentityService,
    ) { }

    async forgotPassword(data: ForgotPasswordDto) {
        const user = await this.getUsersService.findByEmail(data.email);
        if (!user) {
            return { message: 'Se o email existir, as instruções foram enviadas.' };
        }

        const sesCheck = await this.sesIdentityService.checkAndResendSesVerification(user.email);

        if (sesCheck.verificationEmailSent || !sesCheck.alreadyVerified) {
            return {
                status: 'VERIFICATION_EMAIL_SENT',
                message: 'Seu email ainda não foi verificado na AWS. Um novo email de verificação foi enviado.',
            };
        }

        const resetToken = crypto.randomBytes(32).toString('hex');
        const expiresAt = new Date();
        expiresAt.setMinutes(expiresAt.getMinutes() + 30);

        await this.passwordResetTokenRepo.invalidateTokensForUser(user.id);
        await this.passwordResetTokenRepo.createToken(user.id, resetToken, expiresAt);

        const baseUrl = this.getBaseUrl();
        const resetLink = `${baseUrl}/recuperar-senha/${resetToken}`;

        const emailHtml = EmailTemplateGenerator.generate(
            'Recuperação de Senha',
            user.name,
            `<p>Recebemos uma solicitação para redefinir sua senha.</p>
       <p>Clique no botão abaixo para criar uma nova senha:</p>
       <div style="text-align: center; margin: 30px 0;">
         <a href="${resetLink}" class="button" style="background-color: #4F46E5; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; font-weight: bold;">Redefinir Senha</a>
       </div>
       <p style="font-size: 14px; color: #666;">Ou copie e cole o link abaixo no seu navegador:</p>
       <p style="font-size: 12px; color: #4F46E5; word-break: break-all;">${resetLink}</p>
       <p>Este link é válido por 30 minutos.</p>`
        );

        await this.emailService.sendEmailViaSES(
            user.email,
            'Recuperação de Senha - Orfanatos NIB',
            `Olá ${user.name},\n\nRecebemos uma solicitação para redefinir sua senha.\nClique no link abaixo: \n${resetLink}`,
            emailHtml
        );

        return {
            status: 'RESET_LINK_SENT',
            message: 'Se o email existir, as instruções foram enviadas.'
        };
    }

    async validateResetToken(token: string) {
        const validToken = await this.passwordResetTokenRepo.findValidToken(token);
        if (!validToken) {
            throw new BadRequestException('Token inválido ou expirado.');
        }
        return { valid: true, email: validToken.user.email };
    }

    async resetPassword(dto: ResetPasswordDto) {
        const validToken = await this.passwordResetTokenRepo.findValidToken(dto.token);
        if (!validToken) {
            throw new BadRequestException('Token inválido ou expirado.');
        }

        const user = validToken.user;

        await this.updateUserService.update(user.id, {
            password: dto.newPassword,
        });

        await this.passwordResetTokenRepo.deleteToken(dto.token);

        const baseUrl = this.getBaseUrl();
        const emailHtml = EmailTemplateGenerator.generate(
            'Senha Alterada',
            user.name,
            `<p>Sua senha foi alterada com sucesso.</p>
       <p>Agora você pode acessar sua conta com a nova senha.</p>
       <div style="text-align: center; margin: 30px 0;">
         <a href="${baseUrl}" style="background-color: #4F46E5; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; font-weight: bold;">Acessar Plataforma</a>
       </div>`
        );

        await this.emailService.sendEmailViaSES(
            user.email,
            'Senha Alterada com Sucesso - Orfanatos NIB',
            `Olá ${user.name},\n\nSua senha foi alterada com sucesso.`,
            emailHtml
        );

        return { message: 'Senha alterada com sucesso.' };
    }

    private getBaseUrl(): string {
        const env = process.env.ENVIRONMENT || 'local';
        if (env === 'prod' || env === 'production') {
            return 'https://www.orfanatonib.com';
        } else if (env === 'staging') {
            return 'https://staging.orfanatonib.com';
        }
        return 'http://localhost:5173';
    }
}
