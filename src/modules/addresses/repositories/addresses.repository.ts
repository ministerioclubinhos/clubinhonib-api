import { Injectable } from '@nestjs/common';
import { DataSource, Repository } from 'typeorm';
import { AddressEntity } from '../entities/address.entity/address.entity';

@Injectable()
export class AddressesRepository extends Repository<AddressEntity> {
  constructor(private readonly dataSource: DataSource) {
    super(AddressEntity, dataSource.createEntityManager());
  }

  createAddress(partial: Partial<AddressEntity>) {
    return this.create(partial);
  }

  mergeAddress(target: AddressEntity, partial: Partial<AddressEntity>) {
    return this.merge(target, partial);
  }

  saveAddress(entity: AddressEntity) {
    return this.save(entity);
  }

  findById(id: string) {
    return this.findOne({ where: { id } });
  }
}
