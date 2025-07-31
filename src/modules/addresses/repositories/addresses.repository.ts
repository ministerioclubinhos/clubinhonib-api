import { Injectable } from '@nestjs/common';
import { DataSource, Repository } from 'typeorm';
import { AddressEntity } from '../entities/address.entity/address.entity';

@Injectable()
export class AddressesRepository extends Repository<AddressEntity> {
  constructor(private readonly dataSource: DataSource) {
    super(AddressEntity, dataSource.createEntityManager());
  }

  /** Cria uma instância (não persiste) */
  createAddress(partial: Partial<AddressEntity>) {
    return this.create(partial);
  }

  /** Faz merge parcial no alvo (não persiste) */
  mergeAddress(target: AddressEntity, partial: Partial<AddressEntity>) {
    return this.merge(target, partial);
  }

  /** Persiste a entidade (insert/update) */
  saveAddress(entity: AddressEntity) {
    return this.save(entity);
  }

  /** Busca simples por id */
  findById(id: string) {
    return this.findOne({ where: { id } });
  }
}
