import { Injectable, Logger } from '@nestjs/common';
import { AwsSESService } from './aws-ses.service';

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);

  constructor(private readonly awsSESService: AwsSESService) { }

  async sendEmailViaSES(
    to: string,
    subject: string,
    textBody: string,
    htmlBody?: string,
  ): Promise<void> {
    this.logger.log(`Sending email to: ${to} with subject: ${subject}`);
    await this.awsSESService.sendEmailViaSES(to, subject, textBody, htmlBody);
    this.logger.log(`Email sent successfully to: ${to}`);
  }
}
