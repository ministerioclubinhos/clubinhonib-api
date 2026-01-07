import {
  Injectable,
  Logger,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { ContactRepository } from './contact.repository';
import { AwsSesService } from 'src/aws/aws-ses.service';
import { ContactEntity } from './contact.entity';
import { Twilio } from 'twilio';

@Injectable()
export class ContactService {
  private readonly logger = new Logger(ContactService.name);
  private readonly twilio: Twilio;

  constructor(
    private readonly contactRepo: ContactRepository,
    private readonly sesService: AwsSesService,
  ) {
    this.twilio = new Twilio(
      process.env.TWILIO_ACCOUNT_SID ?? '',
      process.env.TWILIO_AUTH_TOKEN ?? '',
    );
  }

  async createContact(data: Partial<ContactEntity>): Promise<ContactEntity> {
    this.logger.debug(
      `📩 Iniciando processo de criação de contato para: ${data.email}`,
    );

    let contact: ContactEntity;
    try {
      contact = await this.contactRepo.saveContact(data);
      this.logger.log(`✅ Contato salvo no banco: ID=${contact.id}`);
    } catch (error) {
      const err = error as Error;
      this.logger.error(
        `❌ Erro ao salvar contato no banco: ${err.message}`,
        err.stack,
      );
      throw new InternalServerErrorException('Erro ao salvar o contato');
    }

    const htmlBody = this.generateContactEmailTemplate(contact);
    const subject = 'Novo contato do site';
    const to = process.env.SES_DEFAULT_TO;

    try {
      await this.sesService.sendEmailViaSES(to || '', subject, '', htmlBody);
      this.logger.log(`📧 E-mail enviado com sucesso para: ${to}`);
    } catch (error) {
      const err = error as Error;
      this.logger.error(`❌ Erro ao enviar e-mail: ${err.message}`, err.stack);
      throw new InternalServerErrorException(
        'Erro ao enviar e-mail de contato',
      );
    }

    const whatsappFrom = process.env.TWILIO_WHATSAPP_FROM;
    const whatsappTo = process.env.TWILIO_WHATSAPP_TO;

    if (whatsappFrom && whatsappTo) {
      const message = this.generateWhatsappMessage(contact);
      try {
        const result = await this.twilio.messages.create({
          body: message,
          from: whatsappFrom,
          to: whatsappTo,
        });
        this.logger.log(`📲 WhatsApp enviado com sucesso! SID: ${result.sid}`);
      } catch (err) {
        const error = err as Error;
        this.logger.error(
          `❌ Erro ao enviar WhatsApp: ${error.message}`,
          error.stack,
        );
        throw new InternalServerErrorException(
          'Erro ao enviar WhatsApp de contato',
        );
      }
    } else {
      this.logger.warn(
        '⚠️ TWILIO_WHATSAPP_FROM ou TO não estão definidos no .env — WhatsApp não será enviado.',
      );
    }

    return contact;
  }

  private generateWhatsappMessage(contact: ContactEntity): string {
    return `
📥 *Novo contato recebido via site Clubinhos NIB!*

👤 *Nome:* ${contact.name}
📧 *E-mail:* ${contact.email}
📱 *Telefone:* ${contact.phone}

💬 *Mensagem:*
${contact.message}
    `.trim();
  }

  private generateContactEmailTemplate(contact: ContactEntity): string {
    const receivedDate = new Date().toLocaleString('pt-BR', {
      timeZone: 'America/Sao_Paulo',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });

    return `
      <!DOCTYPE html>
      <html lang="pt-BR">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Novo contato - Clubinhos NIB</title>
      </head>
      <body style="margin: 0; padding: 0; background-color: #f8fafc; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; -webkit-text-size-adjust: 100%; -ms-text-size-adjust: 100%;">
        <table width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color: #f8fafc;">
          <tr>
            <td align="center" style="padding: 20px 10px;">
              <table width="100%" border="0" cellspacing="0" cellpadding="0" style="max-width: 600px; background-color: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 10px 25px rgba(0,0,0,0.1);">

                <!-- Header -->
                <tr>
                  <td style="background: linear-gradient(135deg, #81d742 0%, #68c93f 100%); padding: 32px 24px; text-align: center;">
                    <table width="100%" border="0" cellspacing="0" cellpadding="0">
                      <tr>
                        <td align="center">
                          <h1 style="margin: 0 0 8px 0; color: #ffffff; font-size: 32px; font-weight: 700; letter-spacing: -0.5px;">
                            📬 Novo Contato Recebido
                          </h1>
                          <p style="margin: 0; color: #e8f5e8; font-size: 18px; font-weight: 400;">
                            Clubinhos NIB
                          </p>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>

                <!-- Timestamp -->
                <tr>
                  <td style="background-color: #f1f5f9; padding: 16px 24px; border-bottom: 1px solid #e2e8f0;">
                    <table width="100%" border="0" cellspacing="0" cellpadding="0">
                      <tr>
                        <td style="color: #64748b; font-size: 14px; text-align: center;">
                          📅 Recebido em ${receivedDate}
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>

                <!-- Content -->
                <tr>
                  <td style="padding: 32px 24px;">
                    <table width="100%" border="0" cellspacing="0" cellpadding="0" style="color: #334155;">

                      <!-- Contact Info -->
                      <tr>
                        <td style="padding-bottom: 24px;">
                          <h2 style="margin: 0 0 20px 0; color: #1e293b; font-size: 20px; font-weight: 600;">
                            👤 Informações do Contato
                          </h2>

                          <table width="100%" border="0" cellspacing="0" cellpadding="0">
                            <tr>
                              <td style="padding: 12px 0; border-bottom: 1px solid #f1f5f9;">
                                <table width="100%" border="0" cellspacing="0" cellpadding="0">
                                  <tr>
                                    <td width="120" style="font-weight: 600; color: #475569; font-size: 14px;">
                                      👤 Nome:
                                    </td>
                                    <td style="color: #1e293b; font-size: 16px; font-weight: 500;">
                                      ${contact.name}
                                    </td>
                                  </tr>
                                </table>
                              </td>
                            </tr>
                            <tr>
                              <td style="padding: 12px 0; border-bottom: 1px solid #f1f5f9;">
                                <table width="100%" border="0" cellspacing="0" cellpadding="0">
                                  <tr>
                                    <td width="120" style="font-weight: 600; color: #475569; font-size: 14px;">
                                      📧 E-mail:
                                    </td>
                                    <td style="color: #1e293b; font-size: 16px;">
                                      <a href="mailto:${contact.email}" style="color: #2563eb; text-decoration: none;">${contact.email}</a>
                                    </td>
                                  </tr>
                                </table>
                              </td>
                            </tr>
                            <tr>
                              <td style="padding: 12px 0;">
                                <table width="100%" border="0" cellspacing="0" cellpadding="0">
                                  <tr>
                                    <td width="120" style="font-weight: 600; color: #475569; font-size: 14px;">
                                      📱 Telefone:
                                    </td>
                                    <td style="color: #1e293b; font-size: 16px;">
                                      <a href="tel:${contact.phone.replace(/\D/g, '')}" style="color: #2563eb; text-decoration: none;">${contact.phone}</a>
                                    </td>
                                  </tr>
                                </table>
                              </td>
                            </tr>
                          </table>
                        </td>
                      </tr>

                      <!-- Message -->
                      <tr>
                        <td>
                          <h2 style="margin: 24px 0 16px 0; color: #1e293b; font-size: 20px; font-weight: 600;">
                            💬 Mensagem
                          </h2>

                          <div style="background: linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%); border: 1px solid #e2e8f0; border-radius: 12px; padding: 20px; margin: 16px 0; position: relative;">
                            <div style="position: absolute; top: -8px; left: 20px; width: 0; height: 0; border-left: 8px solid transparent; border-right: 8px solid transparent; border-bottom: 8px solid #e2e8f0;"></div>
                            <div style="position: absolute; top: -7px; left: 20px; width: 0; height: 0; border-left: 8px solid transparent; border-right: 8px solid transparent; border-bottom: 8px solid #f8fafc;"></div>

                            <p style="margin: 0; color: #475569; font-size: 16px; line-height: 1.6; white-space: pre-line; word-wrap: break-word;">
                              ${contact.message}
                            </p>
                          </div>
                        </td>
                      </tr>

                    </table>
                  </td>
                </tr>

                <!-- Footer -->
                <tr>
                  <td style="background: linear-gradient(135deg, #1e40af 0%, #1d4ed8 100%); padding: 24px; text-align: center;">
                    <table width="100%" border="0" cellspacing="0" cellpadding="0">
                      <tr>
                        <td>
                          <p style="margin: 0 0 8px 0; color: #ffffff; font-size: 16px; font-weight: 600;">
                            💙 Clubinhos NIB
                          </p>
                          <p style="margin: 0; color: #dbeafe; font-size: 14px; line-height: 1.4;">
                            Conectando famílias através da fé e amizade
                          </p>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>

                <!-- Disclaimer -->
                <tr>
                  <td style="background-color: #f8fafc; padding: 16px 24px; text-align: center; border-top: 1px solid #e2e8f0;">
                    <p style="margin: 0; color: #94a3b8; font-size: 12px; line-height: 1.4;">
                      Este é um e-mail automático gerado pelo sistema de contato do Clubinhos NIB.<br>
                      Por favor, responda diretamente ao contato quando apropriado.
                    </p>
                  </td>
                </tr>

              </table>
            </td>
          </tr>
        </table>
      </body>
      </html>
    `;
  }

  async getAllContacts(): Promise<ContactEntity[]> {
    try {
      this.logger.log('📥 Buscando todos os contatos...');
      const contacts = await this.contactRepo.getAll();
      this.logger.log(`✅ ${contacts.length} contato(s) encontrados`);
      return contacts;
    } catch (error) {
      const err = error as Error;
      this.logger.error('❌ Erro ao buscar contatos', err.stack);
      throw new InternalServerErrorException('Erro ao buscar contatos');
    }
  }

  async setReadOnContact(id: string): Promise<ContactEntity> {
    try {
      this.logger.log('📥 Buscando contato...');
      const contact = await this.contactRepo.findOneById(id);

      if (!contact) {
        this.logger.warn(`⚠️ Contato não encontrado com id: ${id}`);
        throw new NotFoundException('Contato não encontrado');
      }

      contact.read = true;

      this.logger.log(`📥 Atualizando contato...`);
      await this.contactRepo.save(contact);

      return contact;
    } catch (error) {
      const err = error as Error;
      this.logger.error('❌ Erro ao buscar ou atualizar contato', err.stack);
      throw new InternalServerErrorException(
        'Erro ao buscar ou atualizar contato',
      );
    }
  }

  async deleteContact(id: string): Promise<void> {
    try {
      this.logger.log(`🗑️ Iniciando exclusão do contato ID=${id}`);

      const contact = await this.contactRepo.findOneById(id);

      if (!contact) {
        this.logger.warn(`⚠️ Contato não encontrado: ID=${id}`);
        throw new NotFoundException('Contato não encontrado');
      }

      await this.contactRepo.remove(contact);

      this.logger.log(`✅ Contato excluído com sucesso: ID=${id}`);
    } catch (error) {
      const err = error as Error;
      this.logger.error(`❌ Erro ao excluir contato ID=${id}`, err.stack);
      throw new InternalServerErrorException('Erro ao excluir contato');
    }
  }
}
