import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { AiProviderSettingEntity } from '../entities/ai-provider-setting.entity';
import { AiProviderSettingsKey } from '../constants/ai-provider-settings.constants';
import {
  StoredAiProviderSettings,
  StoredAiProviderSettingsMerge,
} from '../types/ai-provider-settings.types';

@Injectable()
export class AiProviderSettingRepository {
  constructor(
    @InjectRepository(AiProviderSettingEntity)
    private readonly repo: Repository<AiProviderSettingEntity>,
  ) {}

  async findByProvider(
    provider: AiProviderSettingsKey,
  ): Promise<Record<string, unknown> | null> {
    const record = await this.repo.findOne({ where: { provider } });
    return record?.settings ?? null;
  }

  /**
   * Read-merge-write under a row lock, so two concurrent saves cannot each
   * merge over the same stale snapshot and silently drop the other's change.
   */
  async updateLocked(
    providers: AiProviderSettingsKey[],
    merge: StoredAiProviderSettingsMerge,
  ): Promise<void> {
    await this.repo.manager.transaction(async (manager) => {
      const repo = manager.getRepository(AiProviderSettingEntity);
      const rows = await repo.find({
        where: { provider: In(providers) },
        lock: { mode: 'pessimistic_write' },
      });
      const current: StoredAiProviderSettings = {};
      for (const row of rows)
        current[row.provider as AiProviderSettingsKey] = row.settings;
      const next = merge(current);
      await repo.save(
        Object.entries(next).map(([provider, settings]) =>
          repo.create({ provider, settings: { ...settings } }),
        ),
      );
    });
  }
}
