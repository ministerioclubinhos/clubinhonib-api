import { ConfigService } from '@nestjs/config';
import { WeekMaterialsPageCreateService } from 'src/modules/pages/week-material-page/services/create-week-material.service';
import { WeekMaterialsPageGetService } from 'src/modules/pages/week-material-page/services/get-week-material.service';
import { MediaItemProcessor } from 'src/shared/media/media-item-processor';
import { AwsS3Service } from 'src/shared/providers/aws/aws-s3.service';
import { LessonLlmProviderContract } from '../providers/lesson-llm.types';
import { AiLessonsRepository } from '../repositories/ai-lessons.repository';
import { AdminLessonPromptService } from '../services/admin-lesson-prompt.service';
import { CreateLessonService } from '../services/create-lesson.service';
import { DeleteLessonService } from '../services/delete-lesson.service';
import { DocxExporterService } from '../services/docx-exporter.service';
import { ExportLessonPdfService } from '../services/export-lesson-pdf.service';
import { GetLessonService } from '../services/get-lesson.service';
import { GetLessonPublicationService } from '../services/get-lesson-publication.service';
import { LessonAssetGenerationService } from '../services/lesson-asset-generation.service';
import { LessonDraftService } from '../services/lesson-draft.service';
import { LessonGenerationService } from '../services/lesson-generation.service';
import { LessonStudioSupportService } from '../services/lesson-studio-support.service';
import { PdfLibreOfficeService } from '../services/pdf-libreoffice.service';
import { PublishLessonService } from '../services/publish-lesson.service';
import { UpdateLessonContentService } from '../services/update-lesson-content.service';
import { UpdateLessonReviewService } from '../services/update-lesson-review.service';

export interface LessonStudioServices {
  service: LessonDraftService;
  lessons: GetLessonService;
  support: LessonStudioSupportService;
  assets: LessonAssetGenerationService;
  generation: LessonGenerationService;
  content: UpdateLessonContentService;
  review: UpdateLessonReviewService;
  pdfExport: ExportLessonPdfService;
  publication: PublishLessonService;
  deletion: DeleteLessonService;
}

/**
 * Wires the real studio services over the given boundaries, exactly as the
 * Nest module does. Specs replace only the boundaries (repository, providers).
 */
export function createLessonStudio(
  repo: AiLessonsRepository,
  llm: LessonLlmProviderContract,
  s3: AwsS3Service,
  docx: DocxExporterService,
  pdf: PdfLibreOfficeService,
  weekMaterials: WeekMaterialsPageCreateService,
  weekMaterialsGet: WeekMaterialsPageGetService,
  adminPrompts: AdminLessonPromptService,
  config: ConfigService,
  media: MediaItemProcessor,
): LessonStudioServices {
  const lessons = new GetLessonService(repo);
  const support = new LessonStudioSupportService(repo, s3, media);
  const assets = new LessonAssetGenerationService(s3);
  const generation = new LessonGenerationService(
    repo,
    llm,
    adminPrompts,
    config,
    support,
    lessons,
    assets,
  );
  const content = new UpdateLessonContentService(repo, support, lessons);
  const pdfExport = new ExportLessonPdfService(docx, pdf, lessons);
  const review = new UpdateLessonReviewService(
    repo,
    support,
    lessons,
    pdfExport,
  );
  const publication = new PublishLessonService(
    repo,
    weekMaterials,
    weekMaterialsGet,
    support,
    lessons,
    pdfExport,
  );
  const deletion = new DeleteLessonService(repo, config, support);
  const service = new LessonDraftService(
    new CreateLessonService(repo, support, lessons),
    lessons,
    generation,
    content,
    review,
    pdfExport,
    publication,
    deletion,
    new GetLessonPublicationService(lessons, weekMaterialsGet),
  );
  return {
    service,
    lessons,
    support,
    assets,
    generation,
    content,
    review,
    pdfExport,
    publication,
    deletion,
  };
}
