import { AiProviderSettingsModule } from './ai-provider-settings.module';
import { AiRequestQueueModule } from 'src/shared/providers/ai-queue/ai-request-queue.module';
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { LessonEntity } from './entities/lesson.entity';
import { LessonVersionEntity } from './entities/lesson-version.entity';
import { LessonCommentEntity } from './entities/lesson-comment.entity';
import { LessonStageEntity } from './entities/lesson-stage.entity';
import { AdminLessonPromptEntity } from './entities/admin-lesson-prompt.entity';
import { AiLessonsController } from './controllers/ai-lessons.controller';
import { AiProvidersController } from './controllers/ai-providers.controller';
import { LessonDraftService } from './services/lesson-draft.service';
import { LessonEventStreamService } from './services/lesson-event-stream.service';
import { CreateLessonService } from './services/create-lesson.service';
import { DeleteLessonService } from './services/delete-lesson.service';
import { ExportLessonPdfService } from './services/export-lesson-pdf.service';
import { GetLessonService } from './services/get-lesson.service';
import { GetLessonPublicationService } from './services/get-lesson-publication.service';
import { LessonAssetGenerationService } from './services/lesson-asset-generation.service';
import { LessonGenerationService } from './services/lesson-generation.service';
import { LessonStudioSupportService } from './services/lesson-studio-support.service';
import { PublishLessonService } from './services/publish-lesson.service';
import { UpdateLessonContentService } from './services/update-lesson-content.service';
import { UpdateLessonReviewService } from './services/update-lesson-review.service';
import { MediaModule } from 'src/shared/media/media.module';
import { DocxExporterService } from './services/docx-exporter.service';
import { PdfLibreOfficeService } from './services/pdf-libreoffice.service';
import { AdminLessonPromptService } from './services/admin-lesson-prompt.service';
import { AiProvidersConfigService } from './services/ai-providers-config.service';
import { WeekMaterialsPageModule } from '../pages/week-material-page/week-material-page.module';
import { AiLessonsRepository } from './repositories/ai-lessons.repository';
import { AdminLessonPromptRepository } from './repositories/admin-lesson-prompt.repository';
import { ConfiguredLessonLlmProvider } from './providers/configured-lesson-llm.provider';
import { LESSON_LLM_PROVIDER } from './providers/lesson-llm.constants';

@Module({
  imports: [
    AiProviderSettingsModule,
    AiRequestQueueModule,
    TypeOrmModule.forFeature([
      LessonEntity,
      LessonStageEntity,
      LessonVersionEntity,
      LessonCommentEntity,
      AdminLessonPromptEntity,
    ]),
    WeekMaterialsPageModule,
    MediaModule,
  ],
  controllers: [AiLessonsController, AiProvidersController],
  providers: [
    AiLessonsRepository,
    AdminLessonPromptRepository,
    AiProvidersConfigService,
    { provide: LESSON_LLM_PROVIDER, useClass: ConfiguredLessonLlmProvider },
    GetLessonService,
    GetLessonPublicationService,
    LessonStudioSupportService,
    LessonAssetGenerationService,
    CreateLessonService,
    LessonGenerationService,
    UpdateLessonContentService,
    UpdateLessonReviewService,
    ExportLessonPdfService,
    PublishLessonService,
    DeleteLessonService,
    LessonDraftService,
    LessonEventStreamService,
    DocxExporterService,
    PdfLibreOfficeService,
    AdminLessonPromptService,
  ],
  exports: [
    AiProviderSettingsModule,
    PdfLibreOfficeService,
    LessonDraftService,
    LESSON_LLM_PROVIDER,
    AiLessonsRepository,
    AdminLessonPromptRepository,
    AiProvidersConfigService,
  ],
})
export class AiLessonsModule {}
