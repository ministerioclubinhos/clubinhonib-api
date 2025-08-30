import { Injectable, Logger } from '@nestjs/common';
import { EntityManager } from 'typeorm';
import { AddressEntity } from './entities/address.entity/address.entity';
import { AddressesRepository } from './repositories/addresses.repository';

@Injectable()
export class AddressesService {
  private readonly logger = new Logger(AddressesService.name);

  constructor(private readonly repo: AddressesRepository) {}

  private tag(txId?: string) { return txId ? `[${txId}] ` : ''; }

  create(partial: Partial<AddressEntity>, txId?: string) {
    this.logger.debug(`${this.tag(txId)}create(partial)`);
    return this.repo.create(partial);
  }

  merge(target: AddressEntity, partial: Partial<AddressEntity>, txId?: string) {
    this.logger.debug(`${this.tag(txId)}merge(targetId=${(target as any)?.id ?? 'new'})`);
    return this.repo.merge(target, partial);
  }

  async save(entity: AddressEntity, em?: EntityManager, txId?: string) {
    const t0 = Date.now();
    this.logger.debug(`${this.tag(txId)}save(addressId=${(entity as any)?.id ?? 'new'})…`);
    const out = await this.repo.save(entity);
    this.logger.debug(`${this.tag(txId)}save -> OK (id=${(out as any)?.id}) (ms=${Date.now() - t0})`);
    return out;
  }

  async findById(id: string, em?: EntityManager, txId?: string) {
    const t0 = Date.now();
    this.logger.debug(`${this.tag(txId)}findById(${id})…`);
    const out = await this.repo.findById(id);
    this.logger.debug(`${this.tag(txId)}findById -> ${out ? 'OK' : 'NOT FOUND'} (ms=${Date.now() - t0})`);
    return out;
  }
}
