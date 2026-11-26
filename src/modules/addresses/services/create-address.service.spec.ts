import { Test } from '@nestjs/testing';

import { AddressEntity } from '../entities/address.entity/address.entity';
import { AddressesRepository } from '../repositories/addresses.repository';
import { CreateAddressService } from './create-address.service';

describe('CreateAddressService', () => {
  const repo = { createAddress: jest.fn(), saveAddress: jest.fn() };

  let service: CreateAddressService;

  beforeEach(async () => {
    jest.clearAllMocks();

    const moduleRef = await Test.createTestingModule({
      providers: [
        CreateAddressService,
        { provide: AddressesRepository, useValue: repo },
      ],
    }).compile();

    service = moduleRef.get(CreateAddressService);
  });

  it('monta o endereço sem gravar', async () => {
    // Quem persiste é o agregado dono, dentro da transação dele: gravar aqui
    // deixaria endereço órfão sempre que a criação da criança falhasse depois.
    const montado = Object.assign(new AddressEntity(), { city: 'Manaus' });
    repo.createAddress.mockReturnValue(montado);

    expect(service.build({ city: 'Manaus' })).toBe(montado);
    expect(repo.saveAddress).not.toHaveBeenCalled();
    await Promise.resolve();
  });

  it('grava quando pedido explicitamente', async () => {
    const entidade = Object.assign(new AddressEntity(), { id: 'address-id' });
    repo.saveAddress.mockResolvedValue(entidade);

    await expect(service.save(entidade)).resolves.toBe(entidade);
    expect(repo.saveAddress).toHaveBeenCalledWith(entidade);
  });
});
