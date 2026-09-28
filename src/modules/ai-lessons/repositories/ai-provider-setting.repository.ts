import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AiProviderSettingEntity } from '../entities/ai-provider-setting.entity';

@Injectable()
export class AiProviderSettingRepository {
  constructor(
    @InjectRepository(AiProviderSettingEntity)
    private readonly repo: Repository<AiProviderSettingEntity>,
  ) {}

  async findByProvider(provider: string): Promise<Record<string, any> | null> {
    try {
      const record = await this.repo.findOne({ where: { provider } });
      return record ? record.settings : null;
    } catch {
      return null;
    }
  }

  async saveProviderSettings(
    provider: string,
    settings: Record<string, any>,
  ): Promise<Record<string, any>> {
    try {
      let record = await this.repo.findOne({ where: { provider } });
      if (!record) {
        record = this.repo.create({ provider, settings });
      } else {
        record.settings = settings;
      }
      await this.repo.save(record);
      return record.settings;
    } catch {
      return settings;
    }
  }
}
