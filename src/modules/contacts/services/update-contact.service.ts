import { Injectable, Logger } from '@nestjs/common';

import { ContactsRepository } from '../repositories/contacts.repository';
import { ContactResponseDto } from '../dto/contact-response.dto';
import { toContactResponse } from '../mappers';
import { GetContactsService } from './get-contacts.service';

@Injectable()
export class UpdateContactService {
  private readonly logger = new Logger(UpdateContactService.name);

  constructor(
    private readonly contactsRepository: ContactsRepository,
    private readonly getService: GetContactsService,
  ) {}

  /** Marca como lido, ou de volta como não lido. */
  async setRead(id: string, read: boolean): Promise<ContactResponseDto> {
    const contact = await this.getService.findEntityOrFail(id);

    contact.read = read;
    const saved = await this.contactsRepository.save(contact);

    this.logger.log(
      `Contato marcado como ${read ? 'lido' : 'não lido'}. ID=${id}`,
    );

    return toContactResponse(saved);
  }
}
