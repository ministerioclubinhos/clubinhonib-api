import { Injectable } from '@nestjs/common';

import { AppNotFoundException, ErrorCode } from 'src/shared/exceptions';
import { Paginated } from 'src/shared/dto/paginated.dto';

import { ContactsRepository } from '../repositories/contacts.repository';
import { QueryContactsDto } from '../dto/query-contacts.dto';
import { ContactResponseDto } from '../dto/contact-response.dto';
import { ContactEntity } from '../entities/contact.entity';
import { toContactResponse } from '../mappers';
import { CONTACTS_DEFAULT_LIMIT, CONTACTS_DEFAULT_PAGE } from '../constants';

@Injectable()
export class GetContactsService {
  constructor(private readonly contactsRepository: ContactsRepository) {}

  async findEntityOrFail(id: string): Promise<ContactEntity> {
    const contact = await this.contactsRepository.findById(id);

    if (!contact) {
      throw new AppNotFoundException(
        ErrorCode.CONTACT_NOT_FOUND,
        'Contato não encontrado',
      );
    }

    return contact;
  }

  async findAllPaginated(
    query: QueryContactsDto,
  ): Promise<Paginated<ContactResponseDto>> {
    const page = query.page ?? CONTACTS_DEFAULT_PAGE;
    const limit = query.limit ?? CONTACTS_DEFAULT_LIMIT;

    const { items, total } =
      await this.contactsRepository.findAllPaginated(query);

    return new Paginated(items.map(toContactResponse), total, page, limit);
  }

  async findOne(id: string): Promise<ContactResponseDto> {
    return toContactResponse(await this.findEntityOrFail(id));
  }

  /** Quantos contatos aguardam leitura, para o aviso do painel. */
  async countUnread(): Promise<{ unread: number }> {
    return { unread: await this.contactsRepository.countUnread() };
  }
}
