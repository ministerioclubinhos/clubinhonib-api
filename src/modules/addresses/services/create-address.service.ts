import { Injectable } from '@nestjs/common';

import { AddressEntity } from '../entities/address.entity/address.entity';
import { AddressesRepository } from '../repositories/addresses.repository';

@Injectable()
export class CreateAddressService {
  constructor(private readonly repo: AddressesRepository) {}

  /**
   * Monta o endereço em memória, sem gravar.
   *
   * Quem chama — `children`, `clubs` — persiste o endereço junto com o próprio
   * agregado, dentro da transação dele. Gravar aqui deixaria um endereço órfão
   * sempre que a criação do agregado falhasse depois.
   */
  build(partial: Partial<AddressEntity>): AddressEntity {
    return this.repo.createAddress(partial);
  }

  /** Grava o endereço isoladamente. */
  async save(entity: AddressEntity): Promise<AddressEntity> {
    return this.repo.saveAddress(entity);
  }
}
