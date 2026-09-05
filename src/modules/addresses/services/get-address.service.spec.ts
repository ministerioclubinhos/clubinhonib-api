import { Test } from '@nestjs/testing';

import { AddressEntity } from '../entities/address.entity/address.entity';
import { AddressesRepository } from '../repositories/addresses.repository';
import { GetAddressService } from './get-address.service';

describe('GetAddressService', () => {
  const repo = { findById: jest.fn() };

  let service: GetAddressService;

  beforeEach(async () => {
    jest.clearAllMocks();

    const moduleRef = await Test.createTestingModule({
      providers: [
        GetAddressService,
        { provide: AddressesRepository, useValue: repo },
      ],
    }).compile();

    service = moduleRef.get(GetAddressService);
  });

  it('devolve o endereço encontrado', async () => {
    const endereco = Object.assign(new AddressEntity(), { id: 'address-id' });
    repo.findById.mockResolvedValue(endereco);

    await expect(service.findById('address-id')).resolves.toBe(endereco);
  });

  it('ausência é null, e não erro', async () => {
    repo.findById.mockResolvedValue(null);

    await expect(service.findById('sumido')).resolves.toBeNull();
  });
});
