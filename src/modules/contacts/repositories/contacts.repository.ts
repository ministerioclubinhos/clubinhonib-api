import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, SelectQueryBuilder } from 'typeorm';

import { ContactEntity } from '../entities/contact.entity';
import { QueryContactsDto } from '../dto/query-contacts.dto';
import {
  CONTACTS_DEFAULT_LIMIT,
  CONTACTS_DEFAULT_PAGE,
  CONTACT_DEFAULT_ORDER,
  CONTACT_DEFAULT_SORT,
  CONTACT_SORT_COLUMNS,
} from '../constants';

@Injectable()
export class ContactsRepository {
  constructor(
    @InjectRepository(ContactEntity)
    private readonly repo: Repository<ContactEntity>,
  ) {}

  private baseQB(): SelectQueryBuilder<ContactEntity> {
    return this.repo.createQueryBuilder('contact');
  }

  /**
   * Aplica busca e situação de leitura.
   *
   * A busca é feita no banco, e não na tela: a listagem inteira chegava ao
   * navegador só para ser filtrada lá.
   */
  private applyFilters(
    qb: SelectQueryBuilder<ContactEntity>,
    query: QueryContactsDto,
  ): void {
    const search = query.searchString?.trim();

    if (search) {
      qb.andWhere(
        `(
          LOWER(contact.name) LIKE LOWER(:search) OR
          LOWER(contact.email) LIKE LOWER(:search) OR
          LOWER(contact.phone) LIKE LOWER(:search) OR
          LOWER(contact.message) LIKE LOWER(:search)
        )`,
        { search: `%${search}%` },
      );
    }

    if (query.read !== undefined) {
      qb.andWhere('contact.read = :read', { read: query.read });
    }
  }

  async findAllPaginated(
    query: QueryContactsDto,
  ): Promise<{ items: ContactEntity[]; total: number }> {
    const {
      page = CONTACTS_DEFAULT_PAGE,
      limit = CONTACTS_DEFAULT_LIMIT,
      sort = CONTACT_DEFAULT_SORT,
      order = CONTACT_DEFAULT_ORDER,
    } = query;

    const qb = this.baseQB();
    this.applyFilters(qb, query);

    // O DTO já validou o campo e a direção; aqui só traduzimos para a coluna.
    qb.orderBy(CONTACT_SORT_COLUMNS[sort], order)
      .skip((page - 1) * limit)
      .take(limit);

    const [items, total] = await qb.getManyAndCount();

    return { items, total };
  }

  /** Quantos contatos ainda não foram lidos. */
  async countUnread(): Promise<number> {
    return this.repo.count({ where: { read: false } });
  }

  async findById(id: string): Promise<ContactEntity | null> {
    return this.repo.findOne({ where: { id } });
  }

  async createOne(data: Partial<ContactEntity>): Promise<ContactEntity> {
    return this.repo.save(this.repo.create(data));
  }

  async save(contact: ContactEntity): Promise<ContactEntity> {
    return this.repo.save(contact);
  }

  async deleteById(id: string): Promise<void> {
    await this.repo.delete(id);
  }
}
