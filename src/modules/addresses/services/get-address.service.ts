import { Injectable } from '@nestjs/common';

import { AddressEntity } from '../entities/address.entity/address.entity';
import { AddressesRepository } from '../repositories/addresses.repository';

@Injectable()
export class GetAddressService {
  constructor(private readonly repo: AddressesRepository) {}

  /** O endereço pelo id, ou `null` quando não existe. */
  async findById(id: string): Promise<AddressEntity | null> {
    return this.repo.findById(id);
  }
}
