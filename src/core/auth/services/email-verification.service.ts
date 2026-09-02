import { Injectable, Logger } from '@nestjs/common';
import * as crypto from 'crypto';
import { EmailService } from 'src/shared/email';
import {
  AppBusinessException,
  AppNotFoundException,
  ErrorCode,
} from 'src/shared/exceptions';
import { UserEntity } from 'src/core/user/entities/user.entity';
import { GetUsersService } from 'src/core/user/services/get-user.service';
import { UpdateUserService } from 'src/core/user/services/update-user.service';
import { EmailVerificationTokenRepository } from '../repositories/email-verification-token.repository';
import { SiteUrlService } from 'src/shared/site-url';
import {
  AUTH_EMAIL_PATHS,
  AUTH_TOKEN_BYTES,
  EMAIL_VERIFICATION_MESSAGES,
  EMAIL_VERIFICATION_RESEND_COOLDOWN_MINUTES,
  EMAIL_VERIFICATION_TTL_HOURS,
} from '../constants';

/** Bloco devolvido nas respostas de autenticação. */
export interface EmailVerificationResult {
  verificationEmailSent: boolean;
  message?: string;
}

/**
 * Confirmação de endereço de e-mail com token próprio.
 *
 * Substitui o `VerifyEmailIdentity` do SES, que cadastrava o endereço na conta
 * AWS e nunca informava o app: a conta ficava inativa para sempre, esperando
 * ativação manual.
 */
@Injectable()
export class EmailVerificationService {
  private readonly logger = new Logger(EmailVerificationService.name);

  constructor(
    private readonly tokenRepo: EmailVerificationTokenRepository,
    private readonly emailService: EmailService,
    private readonly getUsersService: GetUsersService,
    private readonly updateUserService: UpdateUserService,
    private readonly siteUrlService: SiteUrlService,
  ) {}

  /**
   * Envia a confirmação quando a conta ainda não está ativa. Uma conta já ativa
   * não recebe nada, e um envio recente não é repetido.
   */
  async sendIfPending(user: UserEntity): Promise<EmailVerificationResult> {
    if (user.active) {
      return {
        verificationEmailSent: false,
        message: EMAIL_VERIFICATION_MESSAGES.verified,
      };
    }

    const latest = await this.tokenRepo.findLatestValidOfUser(user.id);
    if (latest && this.isWithinCooldown(latest.createdAt)) {
      return {
        verificationEmailSent: false,
        message: EMAIL_VERIFICATION_MESSAGES.alreadySent,
      };
    }

    return this.send(user);
  }

  /** Envia a confirmação ignorando o intervalo, para o pedido explícito. */
  async resend(email: string): Promise<EmailVerificationResult> {
    const user = await this.getUsersService.findByEmail(email);

    // A resposta não revela se o endereço existe nem se a conta já está ativa.
    if (!user || user.active) {
      return {
        verificationEmailSent: false,
        message: EMAIL_VERIFICATION_MESSAGES.sent,
      };
    }

    return this.send(user);
  }

  /** Confirma o endereço e ativa a conta. */
  async verify(token: string): Promise<{ email: string }> {
    const stored = await this.tokenRepo.findValidByHash(this.hash(token));

    if (!stored) {
      throw new AppBusinessException(
        ErrorCode.TOKEN_INVALID,
        'Link de confirmação inválido ou expirado.',
      );
    }

    if (!stored.user) {
      throw new AppNotFoundException(
        ErrorCode.USER_NOT_FOUND,
        'Usuário do link de confirmação não encontrado.',
      );
    }

    await this.updateUserService.update(stored.user.id, { active: true });
    await this.tokenRepo.deleteAllOfUser(stored.user.id);

    this.logger.log(
      `Conta ativada por confirmação de e-mail. ID=${stored.user.id}`,
    );

    return { email: stored.user.email };
  }

  private async send(user: UserEntity): Promise<EmailVerificationResult> {
    const token = crypto.randomBytes(AUTH_TOKEN_BYTES).toString('hex');
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + EMAIL_VERIFICATION_TTL_HOURS);

    // Só o hash é gravado; o valor original vive apenas no link do e-mail.
    await this.tokenRepo.deleteAllOfUser(user.id);
    await this.tokenRepo.createToken(user.id, this.hash(token), expiresAt);

    await this.emailService.sendEmailVerification(user.email, {
      recipientName: user.name,
      verificationLink: this.siteUrlService.buildUrl(
        AUTH_EMAIL_PATHS.emailVerification,
        token,
      ),
    });

    return {
      verificationEmailSent: true,
      message: EMAIL_VERIFICATION_MESSAGES.sent,
    };
  }

  private hash(token: string): string {
    return crypto.createHash('sha256').update(token).digest('hex');
  }

  private isWithinCooldown(createdAt: Date): boolean {
    const elapsedMinutes = (Date.now() - createdAt.getTime()) / 60_000;
    return elapsedMinutes < EMAIL_VERIFICATION_RESEND_COOLDOWN_MINUTES;
  }
}
