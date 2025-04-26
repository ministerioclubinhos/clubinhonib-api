import { Body, Controller, Post, Logger } from '@nestjs/common';
import { ContactService } from './contact.service';

@Controller('contact')
export class ContactController {
  private readonly logger = new Logger(ContactController.name);

  constructor(private readonly contactService: ContactService) {}

  @Post()
  async create(@Body() body: {
    name: string;
    email: string;
    phone: string;
    message: string;
  }) {
    this.logger.debug(`📩 Recebendo nova mensagem de contato de: ${body.name} <${body.email}>`);
    
    const result = await this.contactService.createContact(body);
    
    this.logger.log(`✅ Contato criado com sucesso para: ${body.email}`);
    return result;
  }
}
