import { Test } from '@nestjs/testing';

import { AddressEntity } from '../entities/address.entity/address.entity';
import { AddressesRepository } from '../repositories/addresses.repository';
import { UpdateAddressService } from './update-address.service';

describe('UpdateAddressService', () => {
  const repo = { mergeAddress: jest.fn(), saveAddress: jest.fn() };

  let service: UpdateAddressService;

  beforeEach(async () => {
    jest.clearAllMocks();

    const moduleRef = await Test.createTestingModule({
      providers: [
        UpdateAddressService,
        { provide: AddressesRepository, useValue: repo },
      ],
    }).compile();

    service = moduleRef.get(UpdateAddressService);
  });

  it('aplica os campos sobre o endereço existente, sem gravar', () => {
    const atual = Object.assign(new AddressEntity(), {
      id: 'address-id',
      city: 'Manaus',
    });
    repo.mergeAddress.mockImplementation(
      (alvo: AddressEntity, parcial: Partial<AddressEntity>) =>
        Object.assign(alvo, parcial),
    );

    const resultado = service.merge(atual, { city: 'Belém' });

    expect(resultado.city).toBe('Belém');
    // O id é preservado: mesclar não pode virar inserção de uma linha nova.
    expect(resultado.id).toBe('address-id');
    expect(repo.saveAddress).not.toHaveBeenCalled();
  });
});
