import { Injectable, Logger } from '@nestjs/common';
import { ContactRepository } from './contact.repository';
import { ContactEntity } from './contact.entity';
import { NotificationService } from 'src/shared/providers/notification/notification.service';
import {
  AppNotFoundException,
  AppInternalException,
  ErrorCode,
} from 'src/shared/exceptions';

@Injectable()
export class ContactService {
  private readonly logger = new Logger(ContactService.name);

  constructor(
    private readonly contactRepo: ContactRepository,
    private readonly notificationService: NotificationService,
  ) {}

  async createContact(data: Partial<ContactEntity>): Promise<ContactEntity> {
    this.logger.debug(`Creating contact for: ${data.email}`);

    let contact: ContactEntity;
    try {
      contact = await this.contactRepo.saveContact(data);
      this.logger.log(`Contact saved: ID=${contact.id}`);
    } catch (error: unknown) {
      const errMsg = error instanceof Error ? error.message : String(error);
      const errStack = error instanceof Error ? error.stack : undefined;
      this.logger.error(`Error saving contact: ${errMsg}`, errStack);
      throw new AppInternalException(
        ErrorCode.DATABASE_ERROR,
        'Erro ao salvar o contato',
      );
    }

    await this.notificationService.notifyNewContact(contact);

    return contact;
  }

  async getAllContacts(): Promise<ContactEntity[]> {
    try {
      this.logger.log('Fetching all contacts...');
      const contacts = await this.contactRepo.getAll();
      this.logger.log(`${contacts.length} contact(s) found`);
      return contacts;
    } catch (error: unknown) {
      const errStack = error instanceof Error ? error.stack : undefined;
      this.logger.error('Error fetching contacts', errStack);
      throw new AppInternalException(
        ErrorCode.DATABASE_ERROR,
        'Erro ao buscar contatos',
      );
    }
  }

  async setReadOnContact(id: string): Promise<ContactEntity> {
    this.logger.log(`Marking contact as read: ID=${id}`);

    const contact = await this.contactRepo.findOneById(id);

    if (!contact) {
      this.logger.warn(`Contact not found: ID=${id}`);
      throw new AppNotFoundException(
        ErrorCode.CONTACT_NOT_FOUND,
        'Contato não encontrado',
      );
    }

    contact.read = true;

    try {
      await this.contactRepo.save(contact);
      this.logger.log(`Contact marked as read: ID=${id}`);
      return contact;
    } catch (error: unknown) {
      const errStack = error instanceof Error ? error.stack : undefined;
      this.logger.error('Error updating contact', errStack);
      throw new AppInternalException(
        ErrorCode.DATABASE_ERROR,
        'Erro ao atualizar contato',
      );
    }
  }

  async deleteContact(id: string): Promise<void> {
    this.logger.log(`Deleting contact: ID=${id}`);

    const contact = await this.contactRepo.findOneById(id);

    if (!contact) {
      this.logger.warn(`Contact not found: ID=${id}`);
      throw new AppNotFoundException(
        ErrorCode.CONTACT_NOT_FOUND,
        'Contato não encontrado',
      );
    }

    try {
      await this.contactRepo.remove(contact);
      this.logger.log(`Contact deleted: ID=${id}`);
    } catch (error: unknown) {
      const errStack = error instanceof Error ? error.stack : undefined;
      this.logger.error(`Error deleting contact: ID=${id}`, errStack);
      throw new AppInternalException(
        ErrorCode.DATABASE_ERROR,
        'Erro ao excluir contato',
      );
    }
  }
}
