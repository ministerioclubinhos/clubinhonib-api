import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { createHash } from 'node:crypto';
import { AwsS3Service } from 'src/shared/providers/aws/aws-s3.service';
import { LessonEntity } from '../entities/lesson.entity';
import { LessonStageEntity } from '../entities/lesson-stage.entity';
import { LessonVersionEntity } from '../entities/lesson-version.entity';
import { GenerateLessonRequestDto } from '../dto/generate-lesson-request.dto';
import { SaveTiptapContentDto } from '../dto/save-tiptap-content.dto';
import { LESSON_STAGE_ORDER, LessonStageStatus, LessonStageType, LessonStatus, LessonVersionSource, LessonVisualOrientation, LessonVisualType } from '../enums/lesson.enums';
import { GenerateStageRequestDto } from '../dto/generate-stage-request.dto';
import { LESSON_TEMPLATES, templateChecksum } from '../templates/lesson-templates';
import { OpenAiLessonService } from './open-ai-lesson.service';
import { DocxExporterService } from './docx-exporter.service';
import { PdfLibreOfficeService } from './pdf-libreoffice.service';
import { WeekMaterialsPageCreateService } from 'src/modules/pages/week-material-page/services/create-week-material.service';
import { CreateWeekMaterialsPageDto } from 'src/modules/pages/week-material-page/dto/create-week-material.dto';
import { MediaType, UploadType } from 'src/shared/media/media-item/media-item.entity';
import { AdminLessonPromptService } from './admin-lesson-prompt.service';
import { AiLessonsRepository } from '../repositories/ai-lessons.repository';

type JsonObject = Record<string, unknown>;

@Injectable()
export class LessonDraftService {
  constructor(
    private readonly repo: AiLessonsRepository,
    private readonly openAi: OpenAiLessonService,
    private readonly s3: AwsS3Service,
    private readonly docx: DocxExporterService,
    private readonly pdf: PdfLibreOfficeService,
    private readonly weekMaterials: WeekMaterialsPageCreateService,
    private readonly adminPrompts: AdminLessonPromptService,
  ) {}

  async create(dto: GenerateLessonRequestDto, userId: string): Promise<LessonEntity> {
    const lesson = await this.repo.saveLesson(this.repo.createLesson({ theme: dto.theme.trim(), biblicalReference: dto.biblicalReference.trim(), weekNumber: dto.weekNumber ?? 1, status: LessonStatus.DRAFT, createdById: userId }));
    await this.repo.saveStages(LESSON_STAGE_ORDER.map((type) => {
      const template = LESSON_TEMPLATES[type];
      return this.repo.createStage({ lessonId: lesson.id, type, status: LessonStageStatus.NOT_STARTED, currentVersionId: null, templateKey: template.key, templateVersion: template.version, templateChecksum: templateChecksum(template), failureCode: null, failureMessage: null, approvedAt: null, approvedById: null });
    }));
    return this.getById(lesson.id);
  }

  async getDrafts(status?: LessonStatus, page = 1, limit = 10): Promise<{ items: LessonEntity[]; total: number; page: number; limit: number; totalPages: number }> {
    const { items, total } = await this.repo.findDraftsPaginated(status, page, limit);
    const safePage = Math.max(1, Number(page) || 1);
    const safeLimit = Math.min(50, Math.max(1, Number(limit) || 10));
    return { items, total, page: safePage, limit: safeLimit, totalPages: Math.ceil(total / safeLimit) };
  }

  async getDashboard(): Promise<{ total: number; byStatus: Record<LessonStatus, number>; recent: LessonEntity[] }> {
    const rows = await this.repo.getDashboardStatusCounts();
    const byStatus = Object.fromEntries(Object.values(LessonStatus).map((status) => [status, 0])) as Record<LessonStatus, number>;
    rows.forEach((row) => { byStatus[row.status] = Number(row.count); });
    const recent = await this.repo.findRecentLessons(5);
    return { total: Object.values(byStatus).reduce((sum, count) => sum + count, 0), byStatus, recent };
  }

  async getById(id: string): Promise<LessonEntity> {
    let lesson = await this.repo.findLessonById(id);
    if (!lesson) throw new NotFoundException('Lição não encontrada.');
    const missing = [LessonStatus.PUBLISHED, LessonStatus.ARCHIVED].includes(lesson.status) ? [] : LESSON_STAGE_ORDER.filter((type) => !lesson!.stages.some((stage) => stage.type === type));
    if (missing.length) {
      await this.repo.saveStages(missing.map((type) => { const template = LESSON_TEMPLATES[type]; return this.repo.createStage({ lessonId: id, type, status: LessonStageStatus.NOT_STARTED, currentVersionId: null, templateKey: template.key, templateVersion: template.version, templateChecksum: templateChecksum(template), failureCode: null, failureMessage: null, approvedAt: null, approvedById: null }); }));
      lesson = (await this.repo.findLessonById(id))!;
    }
    if (![LessonStatus.PUBLISHED, LessonStatus.ARCHIVED].includes(lesson.status)) {
      const outdated = lesson.stages.filter((stage) => stage.templateChecksum !== templateChecksum(LESSON_TEMPLATES[stage.type]));
      for (const stage of outdated) {
        const template = LESSON_TEMPLATES[stage.type];
        stage.templateKey = template.key; stage.templateVersion = template.version; stage.templateChecksum = templateChecksum(template);
        stage.status = stage.currentVersionId ? LessonStageStatus.STALE : LessonStageStatus.NOT_STARTED;
        stage.approvedAt = null; stage.approvedById = null;
        await this.repo.saveStage(stage);
      }
      if (outdated.length) {
        lesson.status = LessonStatus.IN_PROGRESS;
        await this.repo.saveLesson(lesson);
      }
    }
    lesson.stages.sort((a, b) => LESSON_STAGE_ORDER.indexOf(a.type) - LESSON_STAGE_ORDER.indexOf(b.type));
    for (const stage of lesson.stages) stage.versions?.sort((a, b) => a.versionNumber - b.versionNumber);
    return lesson;
  }

  private currentContent(stage: LessonStageEntity): JsonObject | null {
    return (stage.versions?.find((version) => version.id === stage.currentVersionId)?.structuredDataJson ?? null) as JsonObject | null;
  }

  private assertDependency(lesson: LessonEntity, type: LessonStageType): JsonObject | null {
    const index = LESSON_STAGE_ORDER.indexOf(type);
    if (index === 0) return null;
    const dependency = lesson.stages.find((stage) => stage.type === LESSON_STAGE_ORDER[index - 1]);
    const completedStatuses = [LessonStageStatus.PRODUCER_APPROVED, LessonStageStatus.IN_REVIEW, LessonStageStatus.APPROVED];
    if (!dependency || !completedStatuses.includes(dependency.status)) throw new ConflictException(`A etapa ${LESSON_STAGE_ORDER[index - 1]} precisa ser concluída pelo produtor.`);
    return Object.fromEntries(lesson.stages.filter((stage) => LESSON_STAGE_ORDER.indexOf(stage.type) < index && completedStatuses.includes(stage.status)).map((stage) => [stage.type, this.currentContent(stage)]));
  }

  async generateStage(id: string, dto: GenerateStageRequestDto, userId: string): Promise<LessonEntity> {
    const { stage: type, revisionInstructions } = dto;
    const lesson = await this.getById(id); const stage = lesson.stages.find((item) => item.type === type);
    if (!stage) throw new NotFoundException('Etapa não encontrada.');
    if ([LessonStatus.IN_REVIEW, LessonStatus.READY_FOR_PUBLICATION, LessonStatus.PUBLISHED, LessonStatus.ARCHIVED].includes(lesson.status)) throw new ConflictException('A produção não pode ser regenerada durante ou depois da revisão final.');
    const upstream = this.assertDependency(lesson, type); const template = LESSON_TEMPLATES[type];
    if (stage.templateChecksum !== templateChecksum(template)) throw new ConflictException('O checksum do template ativo diverge do contrato aprovado.');
    const visualConfig = type === LessonStageType.LESSON_VISUALS ? this.validateVisualConfig(dto) : null;
    stage.status = LessonStageStatus.GENERATING; stage.failureCode = null; stage.failureMessage = null; await this.repo.saveStage(stage);
    try {
      const adminPrompt = await this.adminPrompts.effective(userId, type);
      const generated = await this.openAi.generateStage({ theme: lesson.theme, biblicalReference: lesson.biblicalReference, weekNumber: lesson.weekNumber, stage: type, template, approvedUpstream: upstream, adminPrompt, revisionInstructions, visualConfig });
      const derivedVerseStages = [LessonStageType.VERSE_VISUALS, LessonStageType.VERSE_FIXATION, LessonStageType.MEDITATION_YOUNGER, LessonStageType.MEDITATION_OLDER, LessonStageType.MANUAL_WORK];
      let normalized = derivedVerseStages.includes(type) ? this.lockDerivedVerse(lesson, type, generated.content) : generated.content;
      if (visualConfig) {
        const assets = Array.isArray(normalized.assets) ? normalized.assets : [];
        if (assets.length !== visualConfig.quantity) throw new ConflictException(`A geração precisa retornar exatamente ${visualConfig.quantity} imagens.`);
        normalized = { ...normalized, visualConfig };
      }
      const content = await this.generateAndStoreAssets(id, type, normalized);
      const nextVersion = Math.max(0, ...(stage.versions ?? []).map((version) => version.versionNumber)) + 1;
      const entity = this.repo.createVersion({ stageId: stage.id, versionNumber: nextVersion, structuredDataJson: content, tiptapAstJson: this.toTiptap(content), docxS3Key: null, pdfS3Key: null, changeSummary: revisionInstructions ? 'Regeneração orientada por revisão' : 'Geração via OpenAI', createdSource: nextVersion === 1 ? LessonVersionSource.AI_GENERATED : LessonVersionSource.REGENERATION, createdById: userId, openAiResponseId: generated.responseId, adminPromptSnapshot: adminPrompt, adminPromptChecksum: createHash('sha256').update(adminPrompt).digest('hex'), contentChecksum: this.checksum(content) });
      const version = await this.repo.saveVersion(entity);
      stage.currentVersionId = version.id; stage.status = LessonStageStatus.DRAFT; await this.repo.saveStage(stage);
      await this.invalidateDownstream(lesson, type);
      return this.getById(id);
    } catch (error: unknown) {
      stage.status = LessonStageStatus.FAILED; stage.failureCode = 'GENERATION_FAILED'; stage.failureMessage = (error instanceof Error ? error.message : String(error)).slice(0, 500); await this.repo.saveStage(stage); throw error;
    }
  }

  private validateVisualConfig(dto: GenerateStageRequestDto): { type: LessonVisualType; orientation: LessonVisualOrientation; quantity: number } {
    if (!dto.visualType || !dto.visualOrientation || !dto.visualQuantity) throw new BadRequestException('Escolha o tipo pedagógico, a orientação e a quantidade de 1 a 10 imagens.');
    return { type: dto.visualType, orientation: dto.visualOrientation, quantity: dto.visualQuantity };
  }

  private async generateAndStoreAssets(lessonId: string, type: LessonStageType, content: JsonObject): Promise<JsonObject> {
    if (type === LessonStageType.LESSON) return content;
    const key = [LessonStageType.VERSE_VISUALS, LessonStageType.VERSE_FIXATION, LessonStageType.MEDITATION_YOUNGER, LessonStageType.MEDITATION_OLDER, LessonStageType.MANUAL_WORK].includes(type) ? 'printableAssets' : 'assets';
    const assets = Array.isArray(content[key]) ? content[key] as JsonObject[] : [];
    const visualConfig = this.asObject(content.visualConfig);
    const completed: JsonObject[] = [];
    for (const asset of assets) {
      const buffer = await this.openAi.generateImage(String(asset.prompt ?? ''), String(visualConfig.orientation ?? ''), String(visualConfig.type ?? ''));
      const originalname = `${lessonId}-${type}-${String(asset.id)}.png`;
      const url = await this.s3.upload({ buffer, originalname, mimetype: 'image/png', size: buffer.length } as Express.Multer.File);
      completed.push({ ...asset, url });
    }
    return { ...content, [key]: completed };
  }

  private lockDerivedVerse(lesson: LessonEntity, type: LessonStageType, generated: JsonObject): JsonObject {
    const lessonStage = lesson.stages.find((stage) => stage.type === LessonStageType.LESSON);
    const approvedLesson = lessonStage ? this.currentContent(lessonStage) : null;
    const verse = this.asObject(approvedLesson?.memoryVerse);
    const text = String(verse.text ?? '').trim(); const reference = String(verse.reference ?? '').trim();
    if (!text || !reference || String(verse.version ?? '').toUpperCase() !== 'NVI') throw new ConflictException('A lição aprovada precisa ter um único versículo principal NVI antes da fixação.');
    const assets = Array.isArray(generated.printableAssets) ? generated.printableAssets.map((item) => this.asObject(item)) : [];
    if (type !== LessonStageType.VERSE_FIXATION && !assets.length) throw new ConflictException('O material derivado precisa conter ao menos uma peça imprimível.');
    if (type === LessonStageType.VERSE_VISUALS) {
      if (assets.length < 2 || assets.length > 10) throw new ConflictException('Os visuais do versículo devem conter de uma a nove imagens de trechos e uma imagem final da referência.');
      const normalize = (value: string): string => value.trim().replace(/\s+/g, ' ').toLocaleLowerCase('pt-BR');
      const reconstructed = assets.slice(0, -1).map((asset) => String(asset.displayText ?? '').trim()).join(' ');
      if (normalize(reconstructed) !== normalize(text)) throw new ConflictException('A sequência visual não reconstrói exatamente o versículo NVI aprovado, na ordem correta.');
      assets[assets.length - 1] = { ...assets[assets.length - 1], displayText: reference, purpose: 'Referência bíblica para encerrar a memorização' };
    }
    return { ...generated, verseText: text, verseReference: reference, verseVersion: 'NVI', printableAssets: assets };
  }

  private asObject(value: unknown): JsonObject { return value && typeof value === 'object' && !Array.isArray(value) ? value as JsonObject : {}; }

  async saveContent(id: string, dto: SaveTiptapContentDto, userId: string): Promise<LessonEntity> {
    const lesson = await this.getById(id); const stage = lesson.stages.find((item) => item.type === dto.stage);
    if (!stage) throw new NotFoundException('Etapa não encontrada.');
    if (stage.lockVersion !== dto.lockVersion) throw new ConflictException('Esta etapa foi alterada em outra sessão. Recarregue antes de salvar.');
    if (![LessonStageStatus.DRAFT, LessonStageStatus.CHANGES_REQUESTED].includes(stage.status)) throw new ConflictException('A etapa não está editável durante a revisão final.');
    const nextVersion = Math.max(0, ...stage.versions.map((version) => version.versionNumber)) + 1;
    const structured = dto.structuredDataJson ?? this.currentContent(stage) ?? {};
    const entity = this.repo.createVersion({ stageId: stage.id, versionNumber: nextVersion, tiptapAstJson: dto.tiptapAstJson, structuredDataJson: structured, docxS3Key: null, pdfS3Key: null, changeSummary: dto.changeSummary ?? 'Edição manual', createdSource: LessonVersionSource.MANUAL_EDIT, createdById: userId, openAiResponseId: null, adminPromptSnapshot: null, adminPromptChecksum: null, contentChecksum: this.checksum(structured) });
    const version = await this.repo.saveVersion(entity);
    stage.currentVersionId = version.id; stage.status = LessonStageStatus.DRAFT; await this.repo.saveStage(stage);
    await this.invalidateDownstream(lesson, dto.stage); return this.getById(id);
  }

  async completeProductionStage(id: string, type: LessonStageType): Promise<LessonEntity> {
    const lesson = await this.getById(id); const stage = lesson.stages.find((item) => item.type === type);
    if (!stage?.currentVersionId) throw new BadRequestException('Etapa sem conteúdo para concluir.');
    if (![LessonStageStatus.DRAFT, LessonStageStatus.CHANGES_REQUESTED].includes(stage.status)) throw new ConflictException('Somente uma etapa em produção pode ser concluída.');
    stage.status = LessonStageStatus.PRODUCER_APPROVED; stage.approvedAt = null; stage.approvedById = null; await this.repo.saveStage(stage);
    const allReady = lesson.stages.every((item) => item.id === stage.id || [LessonStageStatus.PRODUCER_APPROVED, LessonStageStatus.APPROVED].includes(item.status));
    lesson.status = allReady ? LessonStatus.PACKAGE_READY : LessonStatus.IN_PROGRESS; await this.repo.saveLesson(lesson);
    return this.getById(id);
  }

  async submitPackageReview(id: string): Promise<LessonEntity> {
    const lesson = await this.getById(id);
    if (!lesson.stages.every((stage) => [LessonStageStatus.PRODUCER_APPROVED, LessonStageStatus.APPROVED].includes(stage.status))) throw new ConflictException('Conclua todos os itens antes de submeter o pacote para aprovação final.');
    for (const stage of lesson.stages.filter((item) => item.status === LessonStageStatus.PRODUCER_APPROVED)) { stage.status = LessonStageStatus.IN_REVIEW; await this.repo.saveStage(stage); }
    lesson.status = LessonStatus.IN_REVIEW; await this.repo.saveLesson(lesson); return this.getById(id);
  }

  async approveStage(id: string, type: LessonStageType, userId: string): Promise<LessonEntity> { const lesson = await this.getById(id); const stage = lesson.stages.find((item) => item.type === type); if (lesson.status !== LessonStatus.IN_REVIEW || !stage || stage.status !== LessonStageStatus.IN_REVIEW) throw new ConflictException('Somente um item do pacote em revisão final pode ser aprovado.'); stage.status = LessonStageStatus.APPROVED; stage.approvedById = userId; stage.approvedAt = new Date(); await this.repo.saveStage(stage); if (lesson.stages.every((item) => item.id === stage.id || item.status === LessonStageStatus.APPROVED)) { lesson.status = LessonStatus.READY_FOR_PUBLICATION; await this.repo.saveLesson(lesson); } return this.getById(id); }
  async requestChanges(id: string, type: LessonStageType): Promise<LessonEntity> { const lesson = await this.getById(id); const stage = lesson.stages.find((item) => item.type === type); if (lesson.status !== LessonStatus.IN_REVIEW || !stage || stage.status !== LessonStageStatus.IN_REVIEW) throw new ConflictException('Somente um item do pacote em revisão final pode receber solicitação de ajustes.'); stage.status = LessonStageStatus.CHANGES_REQUESTED; await this.repo.saveStage(stage); for (const pending of lesson.stages.filter((item) => item.id !== stage.id && item.status === LessonStageStatus.IN_REVIEW)) { pending.status = LessonStageStatus.PRODUCER_APPROVED; await this.repo.saveStage(pending); } lesson.status = LessonStatus.CHANGES_REQUESTED; await this.repo.saveLesson(lesson); return this.getById(id); }

  private async invalidateDownstream(lesson: LessonEntity, type: LessonStageType): Promise<void> { const index = LESSON_STAGE_ORDER.indexOf(type); for (const stage of lesson.stages.filter((item) => LESSON_STAGE_ORDER.indexOf(item.type) > index && item.status !== LessonStageStatus.NOT_STARTED)) { stage.status = LessonStageStatus.STALE; stage.approvedAt = null; stage.approvedById = null; await this.repo.saveStage(stage); } lesson.status = LessonStatus.IN_PROGRESS; await this.repo.saveLesson(lesson); }

  async exportPdf(id: string): Promise<{ pdfBuffer: Buffer; fileName: string }> { const lesson = await this.getById(id); if (!lesson.stages.every((stage) => stage.status === LessonStageStatus.APPROVED)) throw new ConflictException('Todas as etapas devem estar aprovadas antes da exportação.'); const content = Object.fromEntries(lesson.stages.map((stage) => { const version = stage.versions.find((item) => item.id === stage.currentVersionId); return [stage.type, { structuredDataJson: version?.structuredDataJson ?? {}, tiptapAstJson: version?.tiptapAstJson ?? null }]; })); const docxBuffer = await this.docx.buildDocxFromTiptapOrStructuredJson(content); const pdfBuffer = await this.pdf.convertDocxToPdf(docxBuffer); return { pdfBuffer, fileName: `licao-semana-${lesson.weekNumber}.pdf` }; }

  async previewStagePdf(id: string, type: LessonStageType): Promise<{ pdfBuffer: Buffer; fileName: string }> {
    const lesson = await this.getById(id); const stage = lesson.stages.find((item) => item.type === type);
    if (!stage?.currentVersionId) throw new BadRequestException('Gere e salve o item antes de visualizar o PDF.');
    const version = stage.versions.find((item) => item.id === stage.currentVersionId);
    if (!version) throw new NotFoundException('Versão atual do item não encontrada.');
    const input = { [type]: { structuredDataJson: version.structuredDataJson, tiptapAstJson: version.tiptapAstJson } };
    const docxBuffer = await this.docx.buildDocxFromTiptapOrStructuredJson(input);
    const pdfBuffer = await this.pdf.convertDocxToPdf(docxBuffer);
    return { pdfBuffer, fileName: `preview-${type.toLowerCase()}-semana-${lesson.weekNumber}.pdf` };
  }

  async publishToWeekMaterial(id: string): Promise<{ lesson: LessonEntity; weekMaterialId: string }> {
    const lesson = await this.getById(id);
    if (lesson.status !== LessonStatus.READY_FOR_PUBLICATION) throw new ConflictException('A produção ainda não possui todas as oito etapas aprovadas.');
    const { pdfBuffer, fileName } = await this.exportPdf(id); const fieldKey = 'generatedLessonPdf';
    const dto = new CreateWeekMaterialsPageDto(); dto.pageTitle = `Lição — ${lesson.theme}`; dto.pageSubtitle = lesson.biblicalReference; dto.pageDescription = `Material completo da semana ${lesson.weekNumber}, revisado e aprovado.`;
    dto.documents = [{ title: `Lição completa — ${lesson.theme}`, description: lesson.biblicalReference, uploadType: UploadType.UPLOAD, mediaType: MediaType.DOCUMENT, isLocalFile: true, fieldKey, originalName: fileName, size: pdfBuffer.length }];
    const file = { fieldname: fieldKey, originalname: fileName, encoding: '7bit', mimetype: 'application/pdf', size: pdfBuffer.length, buffer: pdfBuffer } as Express.Multer.File;
    const page = await this.weekMaterials.createWeekMaterialsPage(dto, { [fieldKey]: file });
    lesson.status = LessonStatus.PUBLISHED; await this.repo.saveLesson(lesson);
    return { lesson: await this.getById(id), weekMaterialId: page.id };
  }

  async delete(id: string): Promise<{ success: boolean; message: string }> {
    const lesson = await this.repo.findLessonById(id);

    if (!lesson) {
      throw new NotFoundException('Lição não encontrada.');
    }

    // Coleta e remove arquivos do S3 (PDFs, DOCXs e imagens geradas nas versões)
    const s3Urls = new Set<string>();
    for (const stage of lesson.stages || []) {
      for (const version of stage.versions || []) {
        if (version.docxS3Key) s3Urls.add(version.docxS3Key);
        if (version.pdfS3Key) s3Urls.add(version.pdfS3Key);
        if (version.structuredDataJson) {
          this.extractS3UrlsFromJson(version.structuredDataJson).forEach((url) => s3Urls.add(url));
        }
      }
    }

    for (const url of s3Urls) {
      await this.s3.delete(url);
    }

    // Remove a lição do banco de dados através do repositório
    await this.repo.removeLesson(lesson);

    return {
      success: true,
      message: 'Lição e todos os seus itens associados foram excluídos com sucesso.',
    };
  }

  private extractS3UrlsFromJson(obj: unknown): string[] {
    const urls: string[] = [];
    const findUrls = (val: unknown) => {
      if (typeof val === 'string') {
        if (val.includes('s3.amazonaws.com') || val.includes('.s3.')) {
          urls.push(val);
        }
      } else if (Array.isArray(val)) {
        val.forEach(findUrls);
      } else if (val && typeof val === 'object') {
        Object.values(val as Record<string, unknown>).forEach(findUrls);
      }
    };
    findUrls(obj);
    return urls;
  }

  private checksum(value: JsonObject): string { return createHash('sha256').update(JSON.stringify(value)).digest('hex'); }
  private toTiptap(value: JsonObject): JsonObject {
    const nodes: JsonObject[] = [];
    const labels: Record<string, string> = { title: 'TÍTULO', biblicalReference: 'TEXTO BÍBLICO', purpose: 'PROPÓSITO', songs: 'MÚSICAS', memoryVerse: 'VERSÍCULO PARA MEMORIZAR', text: 'TEXTO DO VERSÍCULO', reference: 'REFERÊNCIA', version: 'VERSÃO', principleExplanation: 'EXPLICAÇÃO DO PRINCÍPIO', story: 'LIÇÃO BÍBLICA', applicationAndAppeal: 'APLICAÇÃO E APELO', counseling: 'ACONSELHAMENTO / CANTINHO DO ACONSELHAMENTO', reviewQuestions: 'PERGUNTAS DA LIÇÃO', question: 'PERGUNTA', answer: 'RESPOSTA', closingPrayer: 'FALANDO COM DEUS', name: 'NOME', objective: 'OBJETIVO', materials: 'MATERIAIS', preparation: 'PREPARAÇÃO', steps: 'PASSO A PASSO', rulesAndSafety: 'REGRAS E SEGURANÇA', biblicalPrinciple: 'PRINCÍPIO BÍBLICO', verseText: 'TEXTO DO VERSÍCULO', verseReference: 'REFERÊNCIA DO VERSÍCULO', verseVersion: 'VERSÃO BÍBLICA', splitRationale: 'CRITÉRIO DA DIVISÃO', durationMinutes: 'DURAÇÃO EM MINUTOS', ageAdaptations: 'ADAPTAÇÕES POR IDADE', evaluation: 'COMO AVALIAR', ageGroup: 'FAIXA ETÁRIA', biblicalText: 'TEXTO BÍBLICO', introduction: 'ENTENDENDO A LIÇÃO', activities: 'ATIVIDADES', instruction: 'INSTRUÇÃO', prayer: 'FALANDO COM DEUS', printLayout: 'FORMATO DE IMPRESSÃO' };
    const label = (key: string): string => labels[key] ?? key.replace(/([a-z])([A-Z])/g, '$1 $2').replace(/_/g, ' ').toLocaleUpperCase('pt-BR');
    const paragraph = (text: string): JsonObject => ({ type: 'paragraph', content: [{ type: 'text', text }] });
    const append = (key: string, raw: unknown, depth = 2): void => {
      if (['assets', 'printableAssets', 'visualScenes', 'visualConfig'].includes(key)) return;
      nodes.push({ type: 'heading', attrs: { level: Math.min(depth, 3) }, content: [{ type: 'text', text: label(key) }] });
      if (typeof raw === 'string' || typeof raw === 'number' || typeof raw === 'boolean') { nodes.push(paragraph(String(raw))); return; }
      if (Array.isArray(raw)) {
        raw.forEach((item, index) => {
          if (typeof item === 'string') nodes.push({ type: 'bulletList', content: [{ type: 'listItem', content: [paragraph(item)] }] });
          else if (item && typeof item === 'object') {
            const entry = item as JsonObject; const question = String(entry.question ?? '').trim(); const answer = String(entry.answer ?? '').trim();
            if (question || answer) { nodes.push(paragraph(`${index + 1}. ${question}`)); if (answer) nodes.push(paragraph(`Resposta: ${answer}`)); }
            else { nodes.push({ type: 'heading', attrs: { level: 3 }, content: [{ type: 'text', text: `ATIVIDADE ${index + 1}` }] }); Object.entries(entry).filter(([childKey]) => childKey !== 'number').forEach(([childKey, child]) => append(childKey, child, 3)); }
          }
        });
        return;
      }
      if (raw && typeof raw === 'object') Object.entries(raw as JsonObject).forEach(([childKey, child]) => append(childKey, child, 3));
    };
    Object.entries(value).forEach(([key, raw]) => append(key, raw));
    return { type: 'doc', content: nodes };
  }
}
