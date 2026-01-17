import { Injectable } from '@nestjs/common';
import { DataSource, Repository } from 'typeorm';
import { ContactEntity } from './contact.entity';

@Injectable()
export class ContactRepository extends Repository<ContactEntity> {
  constructor(private dataSource: DataSource) {
    super(ContactEntity, dataSource.createEntityManager());
  }

  async saveContact(data: Partial<ContactEntity>): Promise<ContactEntity> {
    const entity = this.create(data);
    return this.save(entity);
  }

  async getAll(): Promise<ContactEntity[]> {
    return this.find({
      order: {        createdAt: 'DESC',      },
    });
  }

  async findOneById(id: string): Promise<ContactEntity | null> {
    return this.findOne({
      where: { id },
    });
  }
  
}
