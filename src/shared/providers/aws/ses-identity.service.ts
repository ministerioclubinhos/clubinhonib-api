import { Injectable, Logger } from '@nestjs/common';
import { AwsSESService } from './aws-ses.service';

export interface SesVerificationResult {
  verificationEmailSent: boolean;
  alreadyVerified: boolean;
  verificationStatus?: 'Success' | 'Pending' | 'Failed' | 'TemporaryFailure' | 'NotStarted';
}

@Injectable()
export class SesIdentityService {
  private readonly logger = new Logger(SesIdentityService.name);

  constructor(private readonly awsSesService: AwsSESService) { }

  async checkAndResendSesVerification(email: string): Promise<SesVerificationResult> {

    try {
      if (!this.awsSesService['sesClient'] || typeof this.awsSesService['sesClient'].send !== 'function') {
        this.logger.warn('Cliente SES não disponível. Pulando verificação de email.');
        return { verificationEmailSent: false, alreadyVerified: false };
      }

      const { GetIdentityVerificationAttributesCommand, VerifyEmailIdentityCommand } = await import('@aws-sdk/client-ses');

      const getCommand = new GetIdentityVerificationAttributesCommand({ Identities: [email] });
      const result = await this.awsSesService['sesClient'].send(getCommand);

      const attrs = result.VerificationAttributes?.[email];
      const verificationStatus = attrs?.VerificationStatus;

      if (verificationStatus === 'Success') {
        return {
          verificationEmailSent: false,
          alreadyVerified: true,
          verificationStatus: 'Success',
        };
      }

      if (verificationStatus === 'Pending') {
        this.logger.log(`Verificação SES já está pendente para: ${email}. Não reenviaremos email.`);
        return {
          verificationEmailSent: true,
          alreadyVerified: false,
          verificationStatus: 'Pending',
        };
      }

      {
        const verifyCommand = new VerifyEmailIdentityCommand({ EmailAddress: email });
        await this.awsSesService['sesClient'].send(verifyCommand);
        this.logger.log(`Email de verificação SES enviado com sucesso para: ${email}`);

        return {
          verificationEmailSent: true,
          alreadyVerified: false,
          verificationStatus: verificationStatus || 'NotStarted',
        };
      }
    } catch (err) {
      this.logger.error(
        `Erro ao checar/reenviar verificação SES para ${email}: ${err?.message}`,
        err?.stack,
      );
      return { verificationEmailSent: false, alreadyVerified: false };
    }
  }

  async verifyEmailIdentitySES(email: string): Promise<SesVerificationResult> {
    try {
      if (!this.awsSesService['sesClient'] || typeof this.awsSesService['sesClient'].send !== 'function') {
        this.logger.warn('Cliente SES não disponível. Pulando cadastro/verificação de email.');
        return { verificationEmailSent: false, alreadyVerified: false };
      }

      const { VerifyEmailIdentityCommand } = await import('@aws-sdk/client-ses');
      const command = new VerifyEmailIdentityCommand({ EmailAddress: email });

      await this.awsSesService['sesClient'].send(command);
      this.logger.log(`Email ${email} cadastrado/verificado com sucesso no SES.`);

      return {
        verificationEmailSent: true,
        alreadyVerified: false,
        verificationStatus: 'Pending',
      };
    } catch (err) {
      this.logger.error(
        `Erro ao cadastrar/verificar email no SES (${email}): ${err?.message}`,
        err?.stack,
      );
      return { verificationEmailSent: false, alreadyVerified: false };
    }
  }
}
