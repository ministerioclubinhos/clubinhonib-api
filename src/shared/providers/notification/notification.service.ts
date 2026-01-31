import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AwsSESService } from '../aws/aws-ses.service';
import { TwilioService } from '../twilio/twilio.service';
import { EmailTemplateGenerator } from 'src/shared/email-template-generator';
import { ContactEntity } from 'src/modules/contacts/contact.entity';

@Injectable()
export class NotificationService {
  private readonly logger = new Logger(NotificationService.name);

  constructor(
    private readonly sesService: AwsSESService,
    private readonly twilioService: TwilioService,
    private readonly configService: ConfigService,
  ) {}

  async notifyNewContact(contact: ContactEntity): Promise<void> {
    const results = await Promise.allSettled([
      this.sendContactEmail(contact),
      this.sendContactWhatsApp(contact),
    ]);

    results.forEach((result, index) => {
      const channel = index === 0 ? 'Email' : 'WhatsApp';
      if (result.status === 'rejected') {
        this.logger.error(`${channel} notification failed: ${result.reason}`);
      }
    });
  }

  private async sendContactEmail(contact: ContactEntity): Promise<void> {
    const receivedDate = this.formatBrazilianDate(new Date());
    const htmlBody = EmailTemplateGenerator.generateContactNotification({
      name: contact.name,
      email: contact.email,
      phone: contact.phone,
      message: contact.message,
      receivedDate,
    });

    const subject = 'Novo contato do site';
    const toAddresses = this.getToAddresses();
    const fromAddresses = this.getFromAddresses();

    if (toAddresses.length === 0) {
      this.logger.warn('SES_DEFAULT_TO not configured, skipping email');
      return;
    }

    for (const to of toAddresses) {
      let sent = false;
      for (const from of fromAddresses) {
        try {
          await this.sesService.sendEmailViaSES(
            to,
            subject,
            '',
            htmlBody,
            from,
          );
          this.logger.log(`Email sent successfully to ${to} (via ${from})`);
          sent = true;
          break;
        } catch (error: any) {
          const err = error as Error;
          this.logger.warn(
            `Failed to send email to ${to} via ${from}: ${err.message}`,
          );
        }
      }
      if (!sent) {
        this.logger.error(
          `Failed to send email to ${to} with all configured senders`,
        );
      }
    }
  }

  private async sendContactWhatsApp(contact: ContactEntity): Promise<void> {
    const whatsappTo = this.configService.get<string>('TWILIO_WHATSAPP_TO');

    if (!whatsappTo) {
      this.logger.warn('TWILIO_WHATSAPP_TO not configured, skipping WhatsApp');
      return;
    }

    const message = this.buildWhatsAppMessage(contact);
    await this.twilioService.sendWhatsApp(whatsappTo, message);
  }

  private buildWhatsAppMessage(contact: ContactEntity): string {
    return `
*Novo contato recebido via site Clubinhos NIB!*

*Nome:* ${contact.name}
*E-mail:* ${contact.email}
*Telefone:* ${contact.phone}

*Mensagem:*
${contact.message}
    `.trim();
  }

  private formatBrazilianDate(date: Date): string {
    return date.toLocaleString('pt-BR', {
      timeZone: 'America/Sao_Paulo',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  private getToAddresses(): string[] {
    const toEnv = this.configService.get<string>('SES_DEFAULT_TO') || '';
    return toEnv
      .split(',')
      .map((e) => e.trim())
      .filter((e) => e.length > 0);
  }

  private getFromAddresses(): string[] {
    const fromEnv =
      this.configService.get<string>('SES_DEFAULT_FROM') ||
      'no-reply@clubinhonib.com';
    return fromEnv
      .split(',')
      .map((e) => e.trim())
      .filter((e) => e.length > 0);
  }
}
