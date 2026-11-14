import { Injectable, Logger } from '@nestjs/common';

import { ContactsRepository } from '../repositories/contacts.repository';
import { GetContactsService } from './get-contacts.service';

@Injectable()
export class DeleteContactService {
  private readonly logger = new Logger(DeleteContactService.name);

  constructor(
    private readonly contactsRepository: ContactsRepository,
    private readonly getService: GetContactsService,
  ) {}

  async remove(id: string): Promise<{ message: string }> {
    await this.getService.findEntityOrFail(id);
    await this.contactsRepository.deleteById(id);

    this.logger.log(`Contato removido. ID=${id}`);

    return { message: 'Contato removido com sucesso' };
  }
}
