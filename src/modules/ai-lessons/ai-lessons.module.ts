import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { LessonEntity } from './entities/lesson.entity';
import { LessonVersionEntity } from './entities/lesson-version.entity';
import { LessonCommentEntity } from './entities/lesson-comment.entity';
import { LessonStageEntity } from './entities/lesson-stage.entity';
import { AdminLessonPromptEntity } from './entities/admin-lesson-prompt.entity';
import { AiProviderSettingEntity } from './entities/ai-provider-setting.entity';
import { AiLessonsController } from './controllers/ai-lessons.controller';
import { AiProvidersController } from './controllers/ai-providers.controller';
import { LessonDraftService } from './services/lesson-draft.service';
import { DocxExporterService } from './services/docx-exporter.service';
import { PdfLibreOfficeService } from './services/pdf-libreoffice.service';
import { AdminLessonPromptService } from './services/admin-lesson-prompt.service';
import { AiProvidersConfigService } from './services/ai-providers-config.service';
import { WeekMaterialsPageModule } from '../pages/week-material-page/week-material-page.module';
import { AiLessonsRepository } from './repositories/ai-lessons.repository';
import { AdminLessonPromptRepository } from './repositories/admin-lesson-prompt.repository';
import { AiProviderSettingRepository } from './repositories/ai-provider-setting.repository';
import { ConfiguredLessonLlmProvider } from './providers/configured-lesson-llm.provider';
import { LESSON_LLM_PROVIDER } from './providers/lesson-llm.constants';
import { GetAiProviderSettingsService } from './services/get-ai-provider-settings.service';
import { UpdateAiProviderSettingsService } from './services/update-ai-provider-settings.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      LessonEntity,
      LessonStageEntity,
      LessonVersionEntity,
      LessonCommentEntity,
      AdminLessonPromptEntity,
      AiProviderSettingEntity,
    ]),
    WeekMaterialsPageModule,
  ],
  controllers: [AiLessonsController, AiProvidersController],
  providers: [
    AiLessonsRepository,
    AdminLessonPromptRepository,
    AiProviderSettingRepository,
    AiProvidersConfigService,
    GetAiProviderSettingsService,
    UpdateAiProviderSettingsService,
    { provide: LESSON_LLM_PROVIDER, useClass: ConfiguredLessonLlmProvider },
    LessonDraftService,
    DocxExporterService,
    PdfLibreOfficeService,
    AdminLessonPromptService,
  ],
  exports: [
    LessonDraftService,
    LESSON_LLM_PROVIDER,
    AiLessonsRepository,
    AdminLessonPromptRepository,
    AiProviderSettingRepository,
    AiProvidersConfigService,
  ],
})
export class AiLessonsModule {}
