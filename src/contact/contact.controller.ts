import { Body, Controller, Post, Get, Patch, Param, Logger, Delete, UseGuards } from '@nestjs/common';
import { ContactService } from './contact.service';
import { ContactEntity } from './contact.entity';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';
import { AdminRoleGuard } from 'src/auth/guards/role-guard';

@Controller('contact')
export class ContactController {
  private readonly logger = new Logger(ContactController.name);

  constructor(private readonly contactService: ContactService) { }

  @Post()
  async create(@Body() body: {
    name: string;
    email: string;
    phone: string;
    message: string;
  }): Promise<ContactEntity> {
    this.logger.debug(`📩 Recebendo nova mensagem de contato de: ${body.name} <${body.email}>`);
    const result = await this.contactService.createContact(body);
    this.logger.log(`✅ Contato criado com sucesso para: ${body.email}`);
    return result;
  }

  @Get()
  @UseGuards(JwtAuthGuard, AdminRoleGuard)
  async getAll(): Promise<ContactEntity[]> {
    this.logger.debug('📥 Requisição para listar todos os contatos');
    const contacts = await this.contactService.getAllContacts();
    this.logger.log(`📄 ${contacts.length} contato(s) retornado(s)`);
    return contacts;
  }

  @Patch(':id/read')
  @UseGuards(JwtAuthGuard, AdminRoleGuard)
  async setRead(@Param('id') id: string): Promise<ContactEntity> {
    this.logger.debug(`📥 Marcando contato como lido: ID=${id}`);
    const contact = await this.contactService.setReadOnContact(id);
    this.logger.log(`✅ Contato marcado como lido: ID=${id}`);
    return contact;
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, AdminRoleGuard)
  async delete(@Param('id') id: string): Promise<void> {
    this.logger.debug(`🗑️ Requisição para deletar contato ID=${id}`);
    await this.contactService.deleteContact(id);
    this.logger.log(`✅ Contato deletado com sucesso ID=${id}`);
  }
}
