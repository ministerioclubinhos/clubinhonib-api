import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { AddressEntity } from './entities/address.entity/address.entity';
import { AddressesRepository } from './repositories/addresses.repository';
import { CreateAddressService } from './services/create-address.service';
import { GetAddressService } from './services/get-address.service';
import { UpdateAddressService } from './services/update-address.service';

/**
 * Endereços.
 *
 * Não tem controller: o módulo não expõe rota nenhuma. Ele existe para
 * `children` e `clubs` montarem e mesclarem endereços dentro das transações
 * deles. O controller que havia aqui era uma classe vazia registrando o prefixo
 * `addresses` sem nenhuma rota.
 */
@Module({
  imports: [TypeOrmModule.forFeature([AddressEntity])],
  providers: [
    AddressesRepository,
    CreateAddressService,
    GetAddressService,
    UpdateAddressService,
  ],
  exports: [CreateAddressService, GetAddressService, UpdateAddressService],
})
export class AddressesModule {}
