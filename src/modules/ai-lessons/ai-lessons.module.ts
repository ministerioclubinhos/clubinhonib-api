import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { LessonEntity } from './entities/lesson.entity';
import { LessonVersionEntity } from './entities/lesson-version.entity';
import { LessonCommentEntity } from './entities/lesson-comment.entity';
import { AiLessonsController } from './controllers/ai-lessons.controller';
import { OpenAiLessonService } from './services/open-ai-lesson.service';
import { LessonDraftService } from './services/lesson-draft.service';
import { DocxExporterService } from './services/docx-exporter.service';
import { PdfLibreOfficeService } from './services/pdf-libreoffice.service';
import { LessonStageEntity } from './entities/lesson-stage.entity';
import { WeekMaterialsPageModule } from '../pages/week-material-page/week-material-page.module';
import { AdminLessonPromptEntity } from './entities/admin-lesson-prompt.entity';
import { AdminLessonPromptService } from './services/admin-lesson-prompt.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([LessonEntity, LessonStageEntity, LessonVersionEntity, LessonCommentEntity, AdminLessonPromptEntity]),
    WeekMaterialsPageModule,
  ],
  controllers: [AiLessonsController],
  providers: [
    OpenAiLessonService,
    LessonDraftService,
    DocxExporterService,
    PdfLibreOfficeService,
    AdminLessonPromptService,
  ],
  exports: [LessonDraftService, OpenAiLessonService],
})
export class AiLessonsModule {}
