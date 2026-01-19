import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Twilio } from 'twilio';

@Injectable()
export class TwilioService {
  private readonly client: Twilio;
  private readonly logger = new Logger(TwilioService.name);

  constructor(private readonly configService: ConfigService) {
    this.client = new Twilio(
      this.configService.get<string>('TWILIO_ACCOUNT_SID') ?? '',
      this.configService.get<string>('TWILIO_AUTH_TOKEN') ?? '',
    );
  }

  async sendWhatsApp(to: string, body: string, from?: string): Promise<string> {
    const fromNumber = from ?? this.configService.get<string>('TWILIO_WHATSAPP_FROM');

    if (!fromNumber) {
      this.logger.warn('TWILIO_WHATSAPP_FROM not configured');
      throw new Error('TWILIO_WHATSAPP_FROM not configured');
    }

    this.logger.debug(`Sending WhatsApp to ${to}`);
    const result = await this.client.messages.create({
      body,
      from: fromNumber,
      to,
    });

    this.logger.log(`WhatsApp sent successfully. SID: ${result.sid}`);
    return result.sid;
  }
}
