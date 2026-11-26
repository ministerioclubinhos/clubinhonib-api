import { Injectable } from '@nestjs/common';
import {
  AppBusinessException,
  AppConflictException,
  AppNotFoundException,
  ErrorCode,
} from 'src/shared/exceptions';
import { LessonEntity } from '../entities/lesson.entity';
import { LessonStageStatus, LessonStageType } from '../enums/lesson.enums';
import type { LessonPdfFile } from '../types/lesson-generation.types';
import { assertStageReadyForCompletionOrPublication } from '../utils/lesson-canonical-content.utils';
import {
  lessonCurrentVersion,
  lessonPdfFileName,
} from '../utils/lesson-workflow.utils';
import { DocxExporterService } from './docx-exporter.service';
import { PdfLibreOfficeService } from './pdf-libreoffice.service';
import { GetLessonService } from './get-lesson.service';

/** Renders approved or in-production items as PDF through the DOCX exporter and LibreOffice. */
@Injectable()
export class ExportLessonPdfService {
  constructor(
    private readonly docx: DocxExporterService,
    private readonly pdf: PdfLibreOfficeService,
    private readonly lessons: GetLessonService,
  ) {}

  async exportPdf(id: string): Promise<LessonPdfFile> {
    const lesson = await this.lessons.getById(id);
    if (
      !lesson.stages.every(
        (stage) => stage.status === LessonStageStatus.APPROVED,
      )
    )
      throw new AppConflictException(
        ErrorCode.LESSON_INVALID_STATE,
        'Todas as etapas devem estar aprovadas antes da exportação.',
      );
    const content = Object.fromEntries(
      lesson.stages.map((stage) => {
        const version = lessonCurrentVersion(stage);
        if (version)
          assertStageReadyForCompletionOrPublication(
            stage.type,
            version.structuredDataJson,
            version.tiptapAstJson,
          );
        return [
          stage.type,
          {
            structuredDataJson: version?.structuredDataJson ?? {},
            tiptapAstJson: version?.tiptapAstJson ?? null,
            createdSource: version?.createdSource,
          },
        ];
      }),
    );
    const docxBuffer = await this.docx.buildDocxFromTiptapOrStructuredJson(
      content,
      lesson.weekNumber,
      lesson.category,
    );
    const pdfBuffer = await this.pdf.convertDocxToPdf(docxBuffer);
    return { pdfBuffer, fileName: lessonPdfFileName(lesson) };
  }

  async previewStagePdf(
    id: string,
    type: LessonStageType,
    expectedLockVersion?: number,
    expectedVersionId?: string,
  ): Promise<LessonPdfFile> {
    return this.renderStagePdf(
      await this.lessons.getById(id),
      type,
      expectedLockVersion,
      expectedVersionId,
    );
  }

  async renderStagePdf(
    lesson: LessonEntity,
    type: LessonStageType,
    expectedLockVersion?: number,
    expectedVersionId?: string,
  ): Promise<LessonPdfFile> {
    const stage = lesson.stages.find((item) => item.type === type);
    if (!stage?.currentVersionId)
      throw new AppBusinessException(
        ErrorCode.LESSON_STAGE_NOT_READY,
        'Gere e salve o item antes de visualizar o PDF.',
      );
    if (
      expectedLockVersion !== undefined &&
      stage.lockVersion !== expectedLockVersion
    ) {
      throw new AppConflictException(
        ErrorCode.LESSON_STAGE_LOCK_CONFLICT,
        'O item foi atualizado em outra sessão. Recarregue antes de visualizar o PDF.',
      );
    }
    if (
      expectedVersionId !== undefined &&
      stage.currentVersionId !== expectedVersionId
    ) {
      throw new AppConflictException(
        ErrorCode.LESSON_STAGE_LOCK_CONFLICT,
        'A versão solicitada para o PDF não corresponde mais à versão atual do item.',
      );
    }
    const version = lessonCurrentVersion(stage);
    if (!version)
      throw new AppNotFoundException(
        ErrorCode.LESSON_STAGE_NOT_FOUND,
        'Versão atual do item não encontrada.',
      );
    assertStageReadyForCompletionOrPublication(
      type,
      version.structuredDataJson,
      version.tiptapAstJson,
    );
    const docxBuffer = await this.docx.buildDocxFromTiptapOrStructuredJson(
      {
        [type]: {
          structuredDataJson: version.structuredDataJson,
          tiptapAstJson: version.tiptapAstJson,
          createdSource: version.createdSource,
        },
      },
      lesson.weekNumber,
      lesson.category,
    );
    // Versions are immutable: the same version always yields the same PDF.
    const pdfBuffer = await this.pdf.convertDocxToPdf(
      docxBuffer,
      `${version.id}:${version.contentChecksum}`,
    );
    return {
      pdfBuffer,
      fileName: lessonPdfFileName(lesson, `preview-${type.toLowerCase()}-`),
    };
  }
}
