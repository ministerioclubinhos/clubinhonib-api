import { Injectable, Logger } from '@nestjs/common';

import { NotificationService } from 'src/shared/providers/notification/notification.service';

import { ContactsRepository } from '../repositories/contacts.repository';
import { CreateContactDto } from '../dto/create-contact.dto';
import { ContactResponseDto } from '../dto/contact-response.dto';
import { toContactResponse } from '../mappers';

@Injectable()
export class CreateContactService {
  private readonly logger = new Logger(CreateContactService.name);

  constructor(
    private readonly contactsRepository: ContactsRepository,
    private readonly notificationService: NotificationService,
  ) {}

  async create(dto: CreateContactDto): Promise<ContactResponseDto> {
    // A rota é pública e a mensagem é pessoal: nada do conteúdo entra no log.
    const contact = await this.contactsRepository.createOne(dto);
    this.logger.log(`Contato criado. ID=${contact.id}`);

    // O aviso à equipe nunca derruba o envio: a mensagem já está salva.
    await this.notificationService.notifyNewContact(contact);

    return toContactResponse(contact);
  }
}
