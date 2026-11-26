import { Injectable } from '@nestjs/common';

import { AddressEntity } from '../entities/address.entity/address.entity';
import { AddressesRepository } from '../repositories/addresses.repository';

@Injectable()
export class UpdateAddressService {
  constructor(private readonly repo: AddressesRepository) {}

  /**
   * Aplica os campos recebidos sobre o endereço, sem gravar.
   *
   * Como no `build`, quem persiste é o agregado dono, dentro da transação
   * dele.
   */
  merge(target: AddressEntity, partial: Partial<AddressEntity>): AddressEntity {
    return this.repo.mergeAddress(target, partial);
  }
}
