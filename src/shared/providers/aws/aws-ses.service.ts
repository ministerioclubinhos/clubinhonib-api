import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  SESClient,
  SendEmailCommand,
} from '@aws-sdk/client-ses';

@Injectable()
export class AwsSESService {
  private readonly logger = new Logger(AwsSESService.name);
  private readonly sesClient: SESClient;
  private readonly region: string;

  constructor(private readonly configService: ConfigService) {
    this.region = this.configService.get<string>('AWS_REGION') || 'us-east-1';

    const accessKeyId = this.configService.get<string>('AWS_ACCESS_KEY_ID') ?? '';
    const secretAccessKey = this.configService.get<string>('AWS_SECRET_ACCESS_KEY') ?? '';

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
      this.configService.get<string>('SES_DEFAULT_FROM') || 'no-reply@orfanatonib.com';

    const toAddresses = to
      .split(',')
      .map((email) => email.trim())
      .filter((email) => email.length > 0);

    if (toAddresses.length === 0) {
      this.logger.warn('No valid email addresses provided');
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
      this.logger.log(`Email sent successfully to: ${toAddresses.join(', ')}`);
    } catch (error) {
      this.logger.error(`Error sending email via SES: ${error.message}`);
      throw new Error('Error sending email');
    }
  }
}
