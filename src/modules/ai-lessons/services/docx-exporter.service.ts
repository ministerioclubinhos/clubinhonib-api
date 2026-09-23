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
    const lesson = this.object(input[LessonStageType.LESSON]);
    this.addHeading(children, String(lesson.title ?? 'LIÇÃO'), 1);
    this.addField(children, 'TEXTO / REFERÊNCIA BÍBLICA', lesson.biblicalReference);
    this.addField(children, 'PROPÓSITO', lesson.purpose);
    this.addList(children, 'MÚSICAS', lesson.songs);
    const verse = this.object(lesson.memoryVerse);
    this.addHeading(children, 'VERSÍCULO PARA MEMORIZAR', 2);
    this.addText(children, `${String(verse.text ?? '')} — ${String(verse.reference ?? '')} (${String(verse.version ?? '')})`);
    this.addField(children, 'EXPLICAÇÃO DO PRINCÍPIO', lesson.principleExplanation);
    this.addField(children, 'HISTÓRIA BÍBLICA', lesson.story);
    this.addField(children, 'APLICAÇÃO E APELO', lesson.applicationAndAppeal);
    this.addField(children, 'CANTINHO DO ACONSELHAMENTO', lesson.counseling);
    this.addQuestions(children, lesson.reviewQuestions);
    this.addField(children, 'FALANDO COM DEUS', lesson.closingPrayer);
    const visualStage = this.object(input[LessonStageType.LESSON_VISUALS]);
    const gameStage = this.object(input[LessonStageType.STANDARD_GAME]);
    const verseVisualStage = this.object(input[LessonStageType.VERSE_VISUALS]);
    const fixationStage = this.object(input[LessonStageType.VERSE_FIXATION]);
    const youngerMeditation = this.object(input[LessonStageType.MEDITATION_YOUNGER]);
    const olderMeditation = this.object(input[LessonStageType.MEDITATION_OLDER]);
    const manualWork = this.object(input[LessonStageType.MANUAL_WORK]);
    this.addStage(children, 'VISUAIS DA LIÇÃO', visualStage);
    this.addStage(children, 'BRINCADEIRA', gameStage);
    this.addStage(children, 'VISUAIS DO VERSÍCULO', verseVisualStage);
    this.addStage(children, 'SUGESTÃO DE FIXAÇÃO DO VERSÍCULO', fixationStage);
    this.addStage(children, 'MEDITAÇÃO PARA CRIANÇAS MENORES', youngerMeditation);
    this.addStage(children, 'MEDITAÇÃO PARA CRIANÇAS MAIORES', olderMeditation);
    this.addStage(children, 'TRABALHO MANUAL', manualWork);

    const header = new Header({ children: [new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, rows: [new TableRow({ children: [new TableCell({ width: { size: 50, type: WidthType.PERCENTAGE }, children: [new Paragraph({ alignment: AlignmentType.LEFT, children: [new ImageRun({ data: left, transformation: { width: 210, height: 84 }, type: 'png' })] })] }), new TableCell({ width: { size: 50, type: WidthType.PERCENTAGE }, children: [new Paragraph({ alignment: AlignmentType.RIGHT, children: [new ImageRun({ data: right, transformation: { width: 210, height: 105 }, type: 'png' })] })] })] })] })] });
    const visualConfig = this.object(visualStage.visualConfig);
    const landscapePages = await this.landscapeAssetPages([...(visualConfig.orientation === 'PORTRAIT' ? [] : [visualStage]), gameStage, verseVisualStage, fixationStage]);
    const portraitVisualPages = visualConfig.orientation === 'PORTRAIT' ? await this.portraitAssetPages(visualStage) : [];
    const supplementaryPages = await this.supplementaryPortraitPages(youngerMeditation, olderMeditation, manualWork);
    const sections = [
      { headers: { default: header }, properties: { page: { margin: { top: 1900, bottom: 1100, left: 1100, right: 1100 } } }, children },
      ...landscapePages.map((page) => ({ headers: { default: header }, properties: { page: { size: { orientation: PageOrientation.LANDSCAPE }, margin: { top: 1700, bottom: 700, left: 700, right: 700 } } }, children: page })),
      ...portraitVisualPages.map((page) => ({ headers: { default: header }, properties: { page: { margin: { top: 1700, bottom: 700, left: 700, right: 700 } } }, children: page })),
      ...supplementaryPages.map((page) => ({ headers: { default: header }, properties: { page: { margin: { top: 1700, bottom: 700, left: 700, right: 700 } } }, children: page })),
    ];
    return Packer.toBuffer(new Document({ styles: { default: { document: { run: { font: 'Arial', size: 22 } } } }, sections }));
  }

  private async header(env: string, fallback: string): Promise<Buffer> { const configured = this.config.get<string>(env); const path = resolve(process.cwd(), configured || fallback); try { return await readFile(path); } catch { throw new UnprocessableEntityException(`Cabeçalho obrigatório ausente: ${env} (${path}).`); } }
  private object(value: unknown): Json { return value && typeof value === 'object' && !Array.isArray(value) ? value as Json : {}; }
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
        pages.push([
          new Paragraph({ alignment: AlignmentType.CENTER, children: [new ImageRun({ data: Buffer.from(image.data), transformation: { width: 880, height: 586 }, type: 'png' })], spacing: { after: 80 } }),
          ...(typeof asset.displayText === 'string' && asset.displayText.trim() ? [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: asset.displayText, bold: true, size: 34, color: '132A85' })], spacing: { after: 60 } })] : []),
          new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: String(asset.altText ?? ''), italics: true, size: 18, color: '555555' })] }),
        ]);
      }
    }
    return pages;
  }

  private async supplementaryPortraitPages(younger: Json, older: Json, manual: Json): Promise<Paragraph[][]> {
    const pages: Paragraph[][] = [];
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
      pages.push([new Paragraph({ alignment: AlignmentType.CENTER, children: [new ImageRun({ data: await this.downloadImage(asset.url), transformation: { width: 586, height: 880 }, type: 'png' })] }), new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: String(asset.altText ?? ''), italics: true, size: 18, color: '555555' })] })]);
    }
    return pages;
  }

  private async meditationPage(data: Json, duplicate: boolean): Promise<Paragraph[]> {
    const copy = async (): Promise<Paragraph[]> => {
      const out: Paragraph[] = [];
      this.addHeading(out, String(data.title ?? (duplicate ? 'MEDITAÇÃO PARA CRIANÇAS MENORES' : 'MEDITAÇÃO PARA CRIANÇAS MAIORES')), 1);
      out.push(new Paragraph({ children: [new TextRun({ text: 'Nome: ____________________________________    Data: ____/____/____', bold: true, size: 18 })], spacing: { after: 70 } }));
      out.push(new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: `VERSÍCULO PARA DECORAR: “${String(data.verseText ?? '')}” (${String(data.verseReference ?? '')} - NVI)`, bold: true, size: duplicate ? 16 : 18 })], spacing: { after: 70 } }));
      if (!duplicate) this.addField(out, 'TEXTO BÍBLICO', data.biblicalText);
      this.addText(out, data.introduction);
      const activities = Array.isArray(data.activities) ? data.activities : [];
      activities.forEach((raw, index) => { const activity = this.object(raw); out.push(new Paragraph({ children: [new TextRun({ text: `${index + 1}. ${String(activity.instruction ?? '')}`, bold: true, size: duplicate ? 16 : 18 })], spacing: { before: 40, after: 40 } })); });
      const assets = Array.isArray(data.printableAssets) ? data.printableAssets : [];
      for (const raw of assets.slice(0, duplicate ? 2 : 3)) {
        const asset = this.object(raw); if (typeof asset.url !== 'string') continue;
        const image = await this.downloadImage(asset.url);
        out.push(new Paragraph({ alignment: AlignmentType.CENTER, children: [new ImageRun({ data: image, transformation: { width: duplicate ? 170 : 220, height: duplicate ? 105 : 135 }, type: 'png' })], spacing: { after: 25 } }));
      }
      out.push(new Paragraph({ children: [new TextRun({ text: `FALANDO COM DEUS: ${String(data.prayer ?? '')}`, bold: true, size: duplicate ? 16 : 18 })], spacing: { before: 45, after: 45 } }));
      return out;
    };
    const first = await copy();
    if (!duplicate) return first;
    return [...first, new Paragraph({ children: [new TextRun('')], border: { bottom: { color: '777777', style: BorderStyle.DASHED, size: 8 } }, spacing: { before: 20, after: 20 } }), ...(await copy())];
  }

  private async manualWorkPage(data: Json): Promise<Paragraph[]> {
    const assets = Array.isArray(data.printableAssets) ? data.printableAssets : [];
    const asset = this.object(assets[0]);
    if (typeof asset.url !== 'string') return [];
    const image = await this.downloadImage(asset.url);
    const oneCopy = (): Paragraph[] => [
      new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: 'TRABALHO MANUAL', bold: true, size: 24 })], spacing: { after: 45 } }),
      new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: `“${String(data.verseText ?? '')}” (${String(data.verseReference ?? '')} - NVI)`, bold: true, size: 16 })], spacing: { after: 45 } }),
      new Paragraph({ alignment: AlignmentType.CENTER, children: [new ImageRun({ data: image, transformation: { width: 500, height: 285 }, type: 'png' })], spacing: { after: 45 } }),
    ];
    return [...oneCopy(), new Paragraph({ children: [new TextRun('')], border: { bottom: { color: '777777', style: BorderStyle.DASHED, size: 8 } }, spacing: { after: 45 } }), ...oneCopy()];
  }

  private async downloadImage(url: string): Promise<Buffer> {
    const image = await axios.get<ArrayBuffer>(url, { responseType: 'arraybuffer', timeout: 30000 });
    return Buffer.from(image.data);
  }
}
