import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AiProviderSettingEntity } from './entities/ai-provider-setting.entity';
import { AiProviderSettingRepository } from './repositories/ai-provider-setting.repository';
import { GetAiProviderSettingsService } from './services/get-ai-provider-settings.service';
import { UpdateAiProviderSettingsService } from './services/update-ai-provider-settings.service';

@Module({
  imports: [TypeOrmModule.forFeature([AiProviderSettingEntity])],
  providers: [
    AiProviderSettingRepository,
    GetAiProviderSettingsService,
    UpdateAiProviderSettingsService,
  ],
  exports: [
    AiProviderSettingRepository,
    GetAiProviderSettingsService,
    UpdateAiProviderSettingsService,
  ],
})
export class AiProviderSettingsModule {}
