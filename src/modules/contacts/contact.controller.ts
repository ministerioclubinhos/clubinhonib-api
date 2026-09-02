import {
  Body,
  Controller,
  Post,
  Get,
  Patch,
  Param,
  Logger,
  Delete,
  UseGuards,
} from '@nestjs/common';
import { ContactService } from './contact.service';
import { ContactEntity } from './contact.entity';
import { CreateContactDto } from './dto/create-contact.dto';
import { JwtAuthGuard } from 'src/core/auth/guards/jwt-auth.guard';
import { AdminRoleGuard } from 'src/core/auth/guards/role-guard';

@Controller('contact')
export class ContactController {
  private readonly logger = new Logger(ContactController.name);

  constructor(private readonly contactService: ContactService) {}

  @Post()
  async create(@Body() dto: CreateContactDto): Promise<ContactEntity> {
    // O endereço não entra no log: a rota é pública e o dado é pessoal.
    this.logger.debug('Nova mensagem de contato recebida.');
    const result = await this.contactService.createContact(dto);
    this.logger.log(`Contato criado. ID=${result.id}`);
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
