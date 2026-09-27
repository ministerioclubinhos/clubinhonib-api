import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { LessonEntity } from './entities/lesson.entity';
import { LessonVersionEntity } from './entities/lesson-version.entity';
import { LessonCommentEntity } from './entities/lesson-comment.entity';
import { LessonStageEntity } from './entities/lesson-stage.entity';
import { AdminLessonPromptEntity } from './entities/admin-lesson-prompt.entity';
import { AiLessonsController } from './controllers/ai-lessons.controller';
import { OpenAiLessonService } from './services/open-ai-lesson.service';
import { LessonDraftService } from './services/lesson-draft.service';
import { DocxExporterService } from './services/docx-exporter.service';
import { PdfLibreOfficeService } from './services/pdf-libreoffice.service';
import { AdminLessonPromptService } from './services/admin-lesson-prompt.service';
import { WeekMaterialsPageModule } from '../pages/week-material-page/week-material-page.module';
import { AiLessonsRepository } from './repositories/ai-lessons.repository';
import { AdminLessonPromptRepository } from './repositories/admin-lesson-prompt.repository';
import { ConfigService } from '@nestjs/config';
import { GeminiLessonLlmProvider } from './providers/gemini-lesson-llm.provider';
import { LESSON_LLM_PROVIDER } from './providers/lesson-llm.constants';
import { LessonLlmProviderContract } from './providers/lesson-llm.types';
import { selectLessonLlmProvider } from './providers/lesson-llm.factory';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      LessonEntity,
      LessonStageEntity,
      LessonVersionEntity,
      LessonCommentEntity,
      AdminLessonPromptEntity,
    ]),
    WeekMaterialsPageModule,
  ],
  controllers: [AiLessonsController],
  providers: [
    AiLessonsRepository,
    AdminLessonPromptRepository,
    OpenAiLessonService,
    GeminiLessonLlmProvider,
    {
      provide: LESSON_LLM_PROVIDER,
      inject: [ConfigService, OpenAiLessonService, GeminiLessonLlmProvider],
      useFactory: (
        config: ConfigService,
        openAi: OpenAiLessonService,
        gemini: GeminiLessonLlmProvider,
      ): LessonLlmProviderContract =>
        selectLessonLlmProvider(config, openAi, gemini),
    },
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
  ],
})
export class AiLessonsModule {}
