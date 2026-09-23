import { Injectable, UnprocessableEntityException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import axios from 'axios';
import { AlignmentType, BorderStyle, Document, Header, HeadingLevel, ImageRun, Packer, PageOrientation, Paragraph, Table, TableCell, TableRow, TextRun, WidthType } from 'docx';
import { LessonStageType } from '../enums/lesson.enums';

type Json = Record<string, unknown>;

@Injectable()
export class DocxExporterService {
  constructor(private readonly config: ConfigService) {}

  async buildDocxFromTiptapOrStructuredJson(input: Json): Promise<Buffer> {
    const [left, right] = await Promise.all([this.header('LESSON_HEADER_LEFT_PATH', '../clubinhonib-app/public/header_esquerdo.png'), this.header('LESSON_HEADER_RIGHT_PATH', '../clubinhonib-app/public/header_direito.png')]);
    const children: Paragraph[] = [];
    const lesson = this.stageData(input[LessonStageType.LESSON]);
    const lessonDoc = this.stageDocument(input[LessonStageType.LESSON]);
    if (Object.keys(lesson).length) {
      if (lessonDoc) this.addTiptap(children, lessonDoc); else {
        this.addHeading(children, String(lesson.title ?? 'LIÇÃO'), 1);
        this.addField(children, 'TEXTO / REFERÊNCIA BÍBLICA', lesson.biblicalReference); this.addField(children, 'PROPÓSITO', lesson.purpose); this.addList(children, 'MÚSICAS', lesson.songs);
        const verse = this.object(lesson.memoryVerse); this.addHeading(children, 'VERSÍCULO PARA MEMORIZAR', 2); this.addText(children, `${String(verse.text ?? '')} — ${String(verse.reference ?? '')} (${String(verse.version ?? '')})`);
        this.addField(children, 'EXPLICAÇÃO DO PRINCÍPIO', lesson.principleExplanation); this.addField(children, 'HISTÓRIA BÍBLICA', lesson.story); this.addField(children, 'APLICAÇÃO E APELO', lesson.applicationAndAppeal); this.addField(children, 'CANTINHO DO ACONSELHAMENTO', lesson.counseling); this.addQuestions(children, lesson.reviewQuestions); this.addField(children, 'FALANDO COM DEUS', lesson.closingPrayer);
      }
    }
    const visualStage = this.stageData(input[LessonStageType.LESSON_VISUALS]);
    const gameStage = this.stageData(input[LessonStageType.STANDARD_GAME]);
    const verseVisualStage = this.stageData(input[LessonStageType.VERSE_VISUALS]);
    const fixationStage = this.stageData(input[LessonStageType.VERSE_FIXATION]);
    const youngerMeditation = this.stageData(input[LessonStageType.MEDITATION_YOUNGER]);
    const olderMeditation = this.stageData(input[LessonStageType.MEDITATION_OLDER]);
    const manualWork = this.stageData(input[LessonStageType.MANUAL_WORK]);
    this.addEditableStage(children, 'BRINCADEIRA', input[LessonStageType.STANDARD_GAME], gameStage);
    this.addEditableStage(children, 'SUGESTÃO DE FIXAÇÃO DO VERSÍCULO', input[LessonStageType.VERSE_FIXATION], fixationStage);

    const header = new Header({ children: [new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, rows: [new TableRow({ children: [new TableCell({ width: { size: 50, type: WidthType.PERCENTAGE }, children: [new Paragraph({ alignment: AlignmentType.LEFT, children: [new ImageRun({ data: left, transformation: { width: 210, height: 84 }, type: 'png' })] })] }), new TableCell({ width: { size: 50, type: WidthType.PERCENTAGE }, children: [new Paragraph({ alignment: AlignmentType.RIGHT, children: [new ImageRun({ data: right, transformation: { width: 210, height: 105 }, type: 'png' })] })] })] })] })] });
    const visualConfig = this.object(visualStage.visualConfig);
    const landscapePages = await this.landscapeAssetPages([...(visualConfig.orientation === 'PORTRAIT' ? [] : [visualStage]), gameStage, verseVisualStage, fixationStage]);
    const portraitVisualPages = visualConfig.orientation === 'PORTRAIT' ? await this.portraitAssetPages(visualStage) : [];
    const supplementaryPages = await this.supplementaryPortraitPages(youngerMeditation, olderMeditation, manualWork);
    const sections = [
      ...(children.length ? [{ headers: { default: header }, properties: { page: { margin: { top: 1900, bottom: 850, left: 900, right: 900 } } }, children }] : []),
      ...landscapePages.map((page) => ({ properties: { page: { size: { orientation: PageOrientation.LANDSCAPE }, margin: { top: 120, bottom: 120, left: 120, right: 120 } } }, children: page })),
      ...portraitVisualPages.map((page) => ({ properties: { page: { margin: { top: 120, bottom: 120, left: 120, right: 120 } } }, children: page })),
      ...supplementaryPages.map((page) => ({ properties: { page: { margin: { top: 220, bottom: 220, left: 220, right: 220 } } }, children: page })),
    ];
    if (!sections.length) throw new UnprocessableEntityException('O item não possui conteúdo renderizável para o preview.');
    return Packer.toBuffer(new Document({ styles: { default: { document: { run: { font: 'Arial', size: 22 } } } }, sections }));
  }

  private async header(env: string, fallback: string): Promise<Buffer> { const configured = this.config.get<string>(env); const path = resolve(process.cwd(), configured || fallback); try { return await readFile(path); } catch { throw new UnprocessableEntityException(`Cabeçalho obrigatório ausente: ${env} (${path}).`); } }
  private object(value: unknown): Json { return value && typeof value === 'object' && !Array.isArray(value) ? value as Json : {}; }
  private stageData(value: unknown): Json { const wrapper = this.object(value); return Object.prototype.hasOwnProperty.call(wrapper, 'structuredDataJson') ? this.object(wrapper.structuredDataJson) : wrapper; }
  private stageDocument(value: unknown): Json | null { const wrapper = this.object(value); const document = this.object(wrapper.tiptapAstJson); return document.type === 'doc' ? document : null; }
  private addEditableStage(out: Paragraph[], title: string, raw: unknown, structured: Json): void { if (!Object.keys(structured).length) return; const document = this.stageDocument(raw); if (document) { this.addHeading(out, title, 1); this.addTiptap(out, document); } else this.addStage(out, title, structured); }
  private addTiptap(out: Paragraph[], document: Json): void {
    const walk = (nodes: unknown, listPrefix = ''): void => {
      if (!Array.isArray(nodes)) return;
      for (const raw of nodes) {
        const node = this.object(raw); const type = String(node.type ?? '');
        if (type === 'bulletList' || type === 'orderedList') { walk(node.content, type === 'orderedList' ? '1. ' : '• '); continue; }
        if (type === 'listItem') { const text = this.tiptapText(node); if (text) this.addText(out, `${listPrefix || '• '}${text}`); continue; }
        if (type === 'heading') { const level = Number(this.object(node.attrs).level) === 1 ? 1 : 2; this.addHeading(out, this.tiptapText(node), level); continue; }
        if (type === 'paragraph' || type === 'blockquote') { const text = this.tiptapText(node); if (text) this.addText(out, type === 'blockquote' ? `“${text}”` : text); continue; }
        walk(node.content, listPrefix);
      }
    };
    walk(document.content);
  }
  private tiptapText(node: Json): string { const content = Array.isArray(node.content) ? node.content : []; return content.map((raw) => { const item = this.object(raw); return typeof item.text === 'string' ? item.text : this.tiptapText(item); }).join(''); }
  private addHeading(out: Paragraph[], text: string, level: 1 | 2): void { out.push(new Paragraph({ heading: level === 1 ? HeadingLevel.HEADING_1 : HeadingLevel.HEADING_2, alignment: level === 1 ? AlignmentType.CENTER : AlignmentType.LEFT, children: [new TextRun({ text: text.toUpperCase(), bold: true, color: level === 1 ? '132A85' : '087C61' })], spacing: { before: 220, after: 120 } })); }
  private addText(out: Paragraph[], value: unknown): void { if (typeof value === 'string' && value.trim()) out.push(new Paragraph({ children: [new TextRun(value)], spacing: { after: 120 } })); }
  private addField(out: Paragraph[], label: string, value: unknown): void { if (typeof value !== 'string' || !value.trim()) return; out.push(new Paragraph({ children: [new TextRun({ text: `${label}: `, bold: true }), new TextRun(value)], spacing: { after: 120 } })); }
  private addList(out: Paragraph[], label: string, value: unknown): void { if (!Array.isArray(value)) return; this.addHeading(out, label, 2); value.forEach((item) => this.addText(out, `• ${String(item)}`)); }
  private addQuestions(out: Paragraph[], value: unknown): void { if (!Array.isArray(value)) return; this.addHeading(out, 'PERGUNTAS DA LIÇÃO', 2); value.forEach((item, index) => { const q = this.object(item); this.addText(out, `${index + 1}. ${String(q.question ?? '')}\nResposta: ${String(q.answer ?? '')}`); }); }
  private addStage(out: Paragraph[], title: string, data: Json): void { if (!Object.keys(data).length) return; this.addHeading(out, title, 1); for (const [key, value] of Object.entries(data)) { if (key === 'assets' || key === 'printableAssets') continue; if (typeof value === 'string') this.addField(out, key, value); else if (Array.isArray(value) && value.every((v) => typeof v === 'string')) this.addList(out, key, value); } }
  private async landscapeAssetPages(stages: Json[]): Promise<Paragraph[][]> {
    const pages: Paragraph[][] = [];
    for (const stage of stages) {
      const rawAssets = stage.assets ?? stage.printableAssets;
      if (!Array.isArray(rawAssets)) continue;
      for (const raw of rawAssets) {
        const asset = this.object(raw);
        if (typeof asset.url !== 'string') continue;
        const image = await axios.get<ArrayBuffer>(asset.url, { responseType: 'arraybuffer', timeout: 30000 });
        const displayText = typeof asset.displayText === 'string' ? asset.displayText.trim() : '';
        pages.push([
          ...(displayText ? [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: displayText.toLocaleUpperCase('pt-BR'), bold: true, size: 38, color: '111111' })], spacing: { before: 20, after: 40 }, keepNext: true })] : []),
          new Paragraph({ alignment: AlignmentType.CENTER, children: [new ImageRun({ data: Buffer.from(image.data), transformation: { width: 1070, height: displayText ? 675 : 758 }, type: 'png' })], spacing: { after: 0 } }),
        ]);
      }
    }
    return pages;
  }

  private async supplementaryPortraitPages(younger: Json, older: Json, manual: Json): Promise<Array<Array<Paragraph | Table>>> {
    const pages: Array<Array<Paragraph | Table>> = [];
    if (Object.keys(younger).length) pages.push(await this.meditationPage(younger, true));
    if (Object.keys(older).length) pages.push(await this.meditationPage(older, false));
    if (Object.keys(manual).length) pages.push(await this.manualWorkPage(manual));
    return pages;
  }

  private async portraitAssetPages(stage: Json): Promise<Paragraph[][]> {
    const rawAssets = Array.isArray(stage.assets) ? stage.assets : [];
    const pages: Paragraph[][] = [];
    for (const raw of rawAssets) {
      const asset = this.object(raw); if (typeof asset.url !== 'string') continue;
      pages.push([new Paragraph({ alignment: AlignmentType.CENTER, children: [new ImageRun({ data: await this.downloadImage(asset.url), transformation: { width: 760, height: 1074 }, type: 'png' })] })]);
    }
    return pages;
  }

  private async meditationPage(data: Json, duplicate: boolean): Promise<Array<Paragraph | Table>> {
    const logo = await this.header('LESSON_HEADER_RIGHT_PATH', '../clubinhonib-app/public/header_direito.png');
    const copy = async (): Promise<Array<Paragraph | Table>> => {
      const out: Array<Paragraph | Table> = [];
      out.push(new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, rows: [new TableRow({ children: [new TableCell({ width: { size: 27, type: WidthType.PERCENTAGE }, children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new ImageRun({ data: logo, transformation: { width: duplicate ? 92 : 112, height: duplicate ? 46 : 56 }, type: 'png' })] })] }), new TableCell({ width: { size: 73, type: WidthType.PERCENTAGE }, shading: { fill: '252223' }, children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: duplicate ? 'MEDITAÇÃO PARA CRIANÇAS MENORES' : 'MEDITAÇÃO PARA CRIANÇAS MAIORES', bold: true, color: 'FFFFFF', size: duplicate ? 18 : 22 })] })] })] })] }));
      out.push(new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: String(data.title ?? '').toLocaleUpperCase('pt-BR'), bold: true, size: duplicate ? 17 : 20 })], spacing: { after: 25 } }));
      out.push(new Paragraph({ children: [new TextRun({ text: 'Nome: __________________________________________   Data: ____/____/____', size: duplicate ? 15 : 18 })], spacing: { after: 30 } }));
      out.push(new Paragraph({ alignment: AlignmentType.CENTER, shading: { fill: 'FFF200' }, children: [new TextRun({ text: 'VERSÍCULO PARA DECORAR', bold: true, size: duplicate ? 16 : 19 })], spacing: { before: 20, after: 20 } }));
      out.push(new Paragraph({ alignment: AlignmentType.CENTER, border: { top: { color: '222222', style: BorderStyle.DASHED, size: 14 }, bottom: { color: '222222', style: BorderStyle.DASHED, size: 14 }, left: { color: '222222', style: BorderStyle.DASHED, size: 14 }, right: { color: '222222', style: BorderStyle.DASHED, size: 14 } }, children: [new TextRun({ text: `“${String(data.verseText ?? '')}” (${String(data.verseReference ?? '')} - NVI)`, size: duplicate ? 14 : 17 })], spacing: { before: 25, after: 25 } }));
      if (!duplicate && typeof data.biblicalText === 'string') out.push(new Paragraph({ children: [new TextRun({ text: 'TEXTO BÍBLICO: ', bold: true }), new TextRun(data.biblicalText)] }));
      if (typeof data.introduction === 'string') out.push(new Paragraph({ children: [new TextRun(data.introduction)], spacing: { after: 40 } }));
      const activities = Array.isArray(data.activities) ? data.activities : [];
      activities.forEach((raw, index) => { const activity = this.object(raw); out.push(new Paragraph({ children: [new TextRun({ text: `${index + 1}. ${String(activity.instruction ?? '')}`, bold: true, size: duplicate ? 16 : 18 })], spacing: { before: 40, after: 40 } })); });
      const assets = Array.isArray(data.printableAssets) ? data.printableAssets : [];
      for (const raw of assets.slice(0, duplicate ? 2 : 3)) {
        const asset = this.object(raw); if (typeof asset.url !== 'string') continue;
        const image = await this.downloadImage(asset.url);
        out.push(new Paragraph({ alignment: AlignmentType.CENTER, children: [new ImageRun({ data: image, transformation: { width: duplicate ? 170 : 220, height: duplicate ? 105 : 135 }, type: 'png' })], spacing: { after: 25 } }));
      }
      out.push(new Paragraph({ shading: { fill: 'E5E5E5' }, children: [new TextRun({ text: 'FALANDO COM DEUS: ', bold: true, color: 'FFFFFF', shading: { fill: '686868' }, size: duplicate ? 15 : 18 }), new TextRun({ text: String(data.prayer ?? ''), size: duplicate ? 15 : 18 })], spacing: { before: 35, after: 35 } }));
      return out;
    };
    const framed = (content: Array<Paragraph | Table>): Table => new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, rows: [new TableRow({ children: [new TableCell({ margins: { top: 90, bottom: 90, left: 90, right: 90 }, borders: { top: { color: '252223', style: BorderStyle.SINGLE, size: 20 }, bottom: { color: '252223', style: BorderStyle.SINGLE, size: 20 }, left: { color: '252223', style: BorderStyle.SINGLE, size: 20 }, right: { color: '252223', style: BorderStyle.SINGLE, size: 20 } }, children: content })] })] });
    const first = framed(await copy());
    if (!duplicate) return [first];
    return [first, new Paragraph({ children: [new TextRun('')], spacing: { before: 20, after: 20 } }), framed(await copy())];
  }

  private async manualWorkPage(data: Json): Promise<Paragraph[]> {
    const assets = Array.isArray(data.printableAssets) ? data.printableAssets : [];
    const asset = this.object(assets[0]);
    if (typeof asset.url !== 'string') return [];
    const image = await this.downloadImage(asset.url);
    const logo = await this.header('LESSON_HEADER_RIGHT_PATH', '../clubinhonib-app/public/header_direito.png');
    const oneCopy = (): Paragraph[] => [
      new Paragraph({ alignment: AlignmentType.CENTER, children: [new ImageRun({ data: logo, transformation: { width: 86, height: 43 }, type: 'png' }), new TextRun({ text: '     TRABALHO MANUAL', bold: true, color: 'FFFFFF', shading: { fill: '111111' }, size: 20 })], spacing: { after: 30 } }),
      new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: `“${String(data.verseText ?? '')}” (${String(data.verseReference ?? '')} - NVI)`, size: 14 })], spacing: { after: 30 } }),
      new Paragraph({ alignment: AlignmentType.CENTER, children: [new ImageRun({ data: image, transformation: { width: 570, height: 318 }, type: 'png' })], spacing: { after: 30 } }),
    ];
    return [...oneCopy(), new Paragraph({ children: [new TextRun('')], border: { bottom: { color: '777777', style: BorderStyle.DASHED, size: 8 } }, spacing: { after: 45 } }), ...oneCopy()];
  }

  private async downloadImage(url: string): Promise<Buffer> {
    const image = await axios.get<ArrayBuffer>(url, { responseType: 'arraybuffer', timeout: 30000 });
    return Buffer.from(image.data);
  }
}
