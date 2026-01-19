import {
  Injectable,
  Logger,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { ContactRepository } from './contact.repository';
import { AwsSESService } from 'src/shared/providers/aws/aws-ses.service';
import { ContactEntity } from './contact.entity';
import { Twilio } from 'twilio';
import { EmailTemplateGenerator } from 'src/shared/email-template-generator';

@Injectable()
export class ContactService {
  private readonly logger = new Logger(ContactService.name);
  private readonly twilio: Twilio;

  constructor(
    private readonly contactRepo: ContactRepository,
    private readonly sesService: AwsSESService,
  ) {
    this.twilio = new Twilio(
      process.env.TWILIO_ACCOUNT_SID ?? '',
      process.env.TWILIO_AUTH_TOKEN ?? '',
    );
  }

  async createContact(data: Partial<ContactEntity>): Promise<ContactEntity> {
    this.logger.debug(`📩 Iniciando processo de criação de contato para: ${data.email}`);

    let contact: ContactEntity;
    try {
      contact = await this.contactRepo.saveContact(data);
      this.logger.log(`✅ Contato salvo no banco: ID=${contact.id}`);
    } catch (error) {
      this.logger.error(`❌ Erro ao salvar contato no banco: ${error.message}`, error.stack);
      throw new InternalServerErrorException('Erro ao salvar o contato');
    }

    const receivedDate = new Date().toLocaleString('pt-BR', {
      timeZone: 'America/Sao_Paulo',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });

    const htmlBody = EmailTemplateGenerator.generateContactNotification({
      name: contact.name,
      email: contact.email,
      phone: contact.phone,
      message: contact.message,
      receivedDate,
    });
    const subject = 'Novo contato do site';
    const to = process.env.SES_DEFAULT_TO;

    try {
      await this.sesService.sendEmailViaSES(to || '', subject, '', htmlBody);
      this.logger.log(`📧 E-mail enviado com sucesso para: ${to}`);
    } catch (error) {
      this.logger.error(`❌ Erro ao enviar e-mail: ${error.message}`, error.stack);
      throw new InternalServerErrorException('Erro ao enviar e-mail de contato');
    }

    const whatsappFrom = process.env.TWILIO_WHATSAPP_FROM;
    const whatsappTo = process.env.TWILIO_WHATSAPP_TO;

    if (whatsappFrom && whatsappTo) {
      const message = this.generateWhatsappMessage(contact);
      try {
        const result = await this.twilio.messages.create({ body: message, from: whatsappFrom, to: whatsappTo, });
        this.logger.log(`📲 WhatsApp enviado com sucesso! SID: ${result.sid}`);
      } catch (err) {
        this.logger.error(`❌ Erro ao enviar WhatsApp: ${err.message}`, err.stack);
        throw new InternalServerErrorException('Erro ao enviar WhatsApp de contato');
      }
    } else {
      this.logger.warn('⚠️ TWILIO_WHATSAPP_FROM ou TO não estão definidos no .env — WhatsApp não será enviado.');
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



  async getAllContacts(): Promise<ContactEntity[]> {
    try {
      this.logger.log('📥 Buscando todos os contatos...');
      const contacts = await this.contactRepo.getAll();
      this.logger.log(`✅ ${contacts.length} contato(s) encontrados`);
      return contacts;
    } catch (error) {
      this.logger.error('❌ Erro ao buscar contatos', error.stack);
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
      this.logger.error('❌ Erro ao buscar ou atualizar contato', error.stack);
      throw new InternalServerErrorException('Erro ao buscar ou atualizar contato');
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
      this.logger.error(`❌ Erro ao excluir contato ID=${id}`, error.stack);
      throw new InternalServerErrorException('Erro ao excluir contato');
    }
  }
}
