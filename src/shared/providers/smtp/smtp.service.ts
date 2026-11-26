import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createTransport, Transporter } from 'nodemailer';
import { AppInternalException, ErrorCode } from 'src/shared/exceptions';
import {
  SMTP_DEFAULT_FROM_NAME,
  SMTP_DEFAULT_HOST,
  SMTP_DEFAULT_PORT,
} from './smtp.constants';
import { MailMessage } from './smtp.types';

/**
 * Transporte SMTP da aplicação. É o único ponto que fala com o servidor de
 * e-mail; quem monta o conteúdo é o módulo de e-mail.
 */
@Injectable()
export class SmtpService implements OnModuleInit {
  private readonly logger = new Logger(SmtpService.name);
  private readonly transporter: Transporter;
  private readonly from: string;
  private readonly fromAddress: string;
  private readonly enabled: boolean;

  constructor(private readonly configService: ConfigService) {
    const host =
      this.configService.get<string>('SMTP_HOST') || SMTP_DEFAULT_HOST;
    const port = Number(
      this.configService.get<string>('SMTP_PORT') || SMTP_DEFAULT_PORT,
    );
    const user = this.configService.get<string>('SMTP_USER') ?? '';
    const password = this.configService.get<string>('SMTP_PASSWORD') ?? '';

    // Sem credenciais não há como enviar. Em vez de quebrar o boot, o serviço
    // registra o aviso e recusa cada envio com um erro claro.
    this.enabled = Boolean(user && password);
    if (!this.enabled) {
      this.logger.warn(
        'SMTP_USER/SMTP_PASSWORD não configurados: nenhum e-mail será enviado.',
      );
    }

    const fromName =
      this.configService.get<string>('MAIL_FROM_NAME') ||
      SMTP_DEFAULT_FROM_NAME;
    // O Gmail exige que o remetente seja a conta autenticada ou um alias dela.
    this.fromAddress =
      this.configService.get<string>('MAIL_FROM_ADDRESS') || user;
    this.from = `"${fromName}" <${this.fromAddress}>`;

    this.transporter = createTransport({
      host,
      port,
      // 465 fala TLS desde o começo; 587 sobe para TLS com STARTTLS.
      secure: port === 465,
      auth: this.enabled ? { user, pass: password } : undefined,
    });
  }

  /** Confere a conexão no boot para que credencial errada apareça cedo. */
  async onModuleInit(): Promise<void> {
    if (!this.enabled) return;

    try {
      await this.transporter.verify();
      this.logger.log('Conexão SMTP verificada.');
    } catch (error: unknown) {
      this.logger.error(
        `Não foi possível verificar a conexão SMTP: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
  }

  async sendMail(message: MailMessage): Promise<void> {
    const to = this.normalize(message.to);
    const bcc = this.normalize(message.bcc);

    if (to.length === 0 && bcc.length === 0) {
      throw new AppInternalException(
        ErrorCode.EMAIL_SEND_ERROR,
        'Nenhum destinatário informado para o e-mail.',
      );
    }

    if (!this.enabled) {
      throw new AppInternalException(
        ErrorCode.EMAIL_SEND_ERROR,
        'Envio de e-mail indisponível: SMTP não configurado.',
      );
    }

    try {
      await this.transporter.sendMail({
        from: this.from,
        // Um envio só por cópia oculta ainda precisa de um cabeçalho `To`
        // válido; o próprio remetente ocupa o lugar.
        to: to.length > 0 ? to : this.fromAddress,
        bcc: bcc.length > 0 ? bcc : undefined,
        subject: message.subject,
        text: message.text,
        html: message.html,
        replyTo: message.replyTo,
      });

      // Nenhum endereço entra no log: o assunto já identifica o envio.
      this.logger.log(
        `E-mail enviado para ${to.length + bcc.length} destinatário(s): "${message.subject}"`,
      );
    } catch (error: unknown) {
      this.logger.error(
        `Falha ao enviar "${message.subject}": ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
      throw new AppInternalException(
        ErrorCode.EMAIL_SEND_ERROR,
        'Erro ao enviar o e-mail.',
        error as Error,
      );
    }
  }

  private normalize(value?: string | string[]): string[] {
    if (!value) return [];
    return (Array.isArray(value) ? value : [value])
      .map((address) => address.trim())
      .filter((address) => address.length > 0);
  }
}
