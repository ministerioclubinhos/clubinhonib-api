import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AiProviderSettingEntity } from '../entities/ai-provider-setting.entity';
import { AiProviderSettingsResponseDto } from '../dto/ai-provider-settings-response.dto';
import { AiProviderSettingsKey } from '../constants/ai-provider-settings.constants';

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

  async saveProviderSettings(
    provider: AiProviderSettingsKey,
    settings: Record<string, unknown>,
  ): Promise<Record<string, unknown>> {
    await this.repo.save(this.repo.create({ provider, settings }));
    return settings;
  }

  async saveAllSettings(
    settings: AiProviderSettingsResponseDto,
  ): Promise<void> {
    await this.repo.manager.transaction(async (manager) => {
      const repo = manager.getRepository(AiProviderSettingEntity);
      await repo.save([
        repo.create({
          provider: AiProviderSettingsKey.OPENAI,
          settings: { ...settings.openai },
        }),
        repo.create({
          provider: AiProviderSettingsKey.GEMINI,
          settings: { ...settings.gemini },
        }),
        repo.create({
          provider: AiProviderSettingsKey.ACTIVE,
          settings: { llmProvider: settings.llmProvider },
        }),
      ]);
    });
  }
}
