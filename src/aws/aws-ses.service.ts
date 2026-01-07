import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SESClient, SendEmailCommand } from '@aws-sdk/client-ses';

@Injectable()
export class AwsSesService {
  private readonly logger = new Logger(AwsSesService.name);
  private readonly sesClient: SESClient;
  private readonly region: string;

  constructor(private readonly configService: ConfigService) {
    this.region = this.configService.get<string>('AWS_REGION') || 'us-east-2';

    const accessKeyId =
      this.configService.get<string>('AWS_ACCESS_KEY_ID') ?? '';
    const secretAccessKey =
      this.configService.get<string>('AWS_SECRET_ACCESS_KEY') ?? '';

    this.sesClient = new SESClient({
      region: this.region,
      credentials: {
        accessKeyId,
        secretAccessKey,
      },
    });
  }

  async sendEmailViaSES(
    to: string,
    subject: string,
    textBody: string,
    htmlBody?: string,
  ): Promise<void> {
    const from =
      this.configService.get<string>('SES_DEFAULT_FROM') ??
      'no-reply@clubinhonib.com';

    const toAddresses = to
      .split(',')
      .map((email) => email.trim())
      .filter((email) => email.length > 0);

    if (toAddresses.length === 0) {
      this.logger.warn('⚠️ Nenhum destinatário válido fornecido');
      return;
    }

    const command = new SendEmailCommand({
      Destination: {
        ToAddresses: toAddresses,
      },
      Message: {
        Subject: {
          Data: subject,
        },
        Body: {
          Text: {
            Data: textBody,
          },
          ...(htmlBody && {
            Html: {
              Data: htmlBody,
            },
          }),
        },
      },
      Source: from,
    });

    try {
      await this.sesClient.send(command);
      this.logger.log(
        `📨 E-mail enviado via SES para: ${toAddresses.join(', ')}`,
      );
    } catch (error) {
      const err = error as Error;
      this.logger.error(`❌ Erro ao enviar e-mail via SES: ${err.message}`);
      throw new Error('Erro ao enviar e-mail');
    }
  }
}
