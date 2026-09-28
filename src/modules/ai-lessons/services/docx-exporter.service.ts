import { Injectable, UnprocessableEntityException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import axios from 'axios';
import {
  AlignmentType,
  BorderStyle,
  Document,
  HeadingLevel,
  ImageRun,
  Packer,
  PageOrientation,
  Paragraph,
  Table,
  TableCell,
  TableRow,
  TextRun,
  WidthType,
} from 'docx';
import { LessonStageType } from '../enums/lesson.enums';

type Json = Record<string, unknown>;
type Alignment = (typeof AlignmentType)[keyof typeof AlignmentType];

@Injectable()
export class DocxExporterService {
  constructor(private readonly config: ConfigService) {}

  async buildDocxFromTiptapOrStructuredJson(input: Json): Promise<Buffer> {
    const [left, right] = await Promise.all([
      this.header(
        'LESSON_HEADER_LEFT_PATH',
        '../clubinhonib-app/public/header_esquerdo.png',
      ),
      this.header(
        'LESSON_HEADER_RIGHT_PATH',
        '../clubinhonib-app/public/header_direito.png',
      ),
    ]);
    const children: (Paragraph | Table)[] = [];
    const lesson = this.stageData(input[LessonStageType.LESSON]);
    const lessonDoc = this.stageDocument(input[LessonStageType.LESSON]);
    if (Object.keys(lesson).length) {
      if (lessonDoc) {
        this.addTiptap(children, lessonDoc);
      } else {
        this.addHeading(children, String(lesson.title ?? 'LIÇÃO'), 1);
        this.addField(
          children,
          'TEXTO / REFERÊNCIA BÍBLICA',
          lesson.biblicalReference,
        );
        this.addField(children, 'PROPÓSITO', lesson.purpose);
        this.addList(children, 'MÚSICAS', lesson.songs);
        const verse = this.object(lesson.memoryVerse);
        this.addHeading(children, 'VERSÍCULO PARA MEMORIZAR', 2);
        this.addText(
          children,
          `${String(verse.text ?? '')} — ${String(verse.reference ?? '')} (${String(verse.version ?? '')})`,
        );
        this.addField(
          children,
          'EXPLICAÇÃO DO PRINCÍPIO',
          lesson.principleExplanation,
        );
        this.addField(children, 'HISTÓRIA BÍBLICA', lesson.story);
        this.addField(
          children,
          'APLICAÇÃO E APELO',
          lesson.applicationAndAppeal,
        );
        this.addField(
          children,
          'CANTINHO DO ACONSELHAMENTO',
          lesson.counseling,
        );
        this.addQuestions(children, lesson.reviewQuestions);
        this.addField(children, 'FALANDO COM DEUS', lesson.closingPrayer);
      }
    }
    const visualStage = this.stageData(input[LessonStageType.LESSON_VISUALS]);
    const gameStage = this.stageData(input[LessonStageType.STANDARD_GAME]);
    const verseVisualStage = this.stageData(
      input[LessonStageType.VERSE_VISUALS],
    );
    const fixationStage = this.stageData(input[LessonStageType.VERSE_FIXATION]);
    const youngerMeditation = this.stageData(
      input[LessonStageType.MEDITATION_YOUNGER],
    );
    const olderMeditation = this.stageData(
      input[LessonStageType.MEDITATION_OLDER],
    );
    const manualWork = this.stageData(input[LessonStageType.MANUAL_WORK]);

    this.addEditableStage(
      children,
      'BRINCADEIRA',
      input[LessonStageType.STANDARD_GAME],
      gameStage,
    );
    this.addEditableStage(
      children,
      'SUGESTÃO DE FIXAÇÃO DO VERSÍCULO',
      input[LessonStageType.VERSE_FIXATION],
      fixationStage,
    );

    const headerTable = new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      borders: {
        top: { style: BorderStyle.NONE },
        bottom: { style: BorderStyle.NONE },
        left: { style: BorderStyle.NONE },
        right: { style: BorderStyle.NONE },
        insideHorizontal: { style: BorderStyle.NONE },
        insideVertical: { style: BorderStyle.NONE },
      },
      rows: [
        new TableRow({
          children: [
            new TableCell({
              width: { size: 50, type: WidthType.PERCENTAGE },
              borders: {
                top: { style: BorderStyle.NONE },
                bottom: { style: BorderStyle.NONE },
                left: { style: BorderStyle.NONE },
                right: { style: BorderStyle.NONE },
              },
              children: [
                new Paragraph({
                  alignment: AlignmentType.LEFT,
                  children: [
                    new ImageRun({
                      data: left,
                      transformation: { width: 190, height: 76 },
                      type: 'png',
                    }),
                  ],
                }),
              ],
            }),
            new TableCell({
              width: { size: 50, type: WidthType.PERCENTAGE },
              borders: {
                top: { style: BorderStyle.NONE },
                bottom: { style: BorderStyle.NONE },
                left: { style: BorderStyle.NONE },
                right: { style: BorderStyle.NONE },
              },
              children: [
                new Paragraph({
                  alignment: AlignmentType.RIGHT,
                  children: [
                    new ImageRun({
                      data: right,
                      transformation: { width: 190, height: 95 },
                      type: 'png',
                    }),
                  ],
                }),
              ],
            }),
          ],
        }),
      ],
    });

    const bodyElements: (Paragraph | Table)[] = children.length
      ? [headerTable, new Paragraph({ spacing: { after: 180 } }), ...children]
      : [];

    const visualConfig = this.object(visualStage.visualConfig);
    const landscapePages = await this.landscapeAssetPages([
      ...(visualConfig.orientation === 'PORTRAIT'
        ? []
        : [{ stage: visualStage, imageOnly: true }]),
      { stage: gameStage, imageOnly: false },
      { stage: verseVisualStage, imageOnly: true },
      { stage: fixationStage, imageOnly: false },
    ]);
    const portraitVisualPages =
      visualConfig.orientation === 'PORTRAIT'
        ? await this.portraitAssetPages(visualStage)
        : [];
    const supplementaryPages = await this.supplementaryPortraitPages(
      youngerMeditation,
      olderMeditation,
      manualWork,
    );
    const sections = [
      ...(bodyElements.length
        ? [
            {
              properties: {
                page: {
                  margin: { top: 1134, bottom: 1134, left: 1134, right: 1134 },
                },
              },
              children: bodyElements,
            },
          ]
        : []),
      ...landscapePages.map((page) => ({
        properties: {
          page: {
            size: { orientation: PageOrientation.LANDSCAPE },
            margin: { top: 120, bottom: 120, left: 120, right: 120 },
          },
        },
        children: page,
      })),
      ...portraitVisualPages.map((page) => ({
        properties: {
          page: { margin: { top: 120, bottom: 120, left: 120, right: 120 } },
        },
        children: page,
      })),
      ...supplementaryPages.map((page) => ({
        properties: {
          page: { margin: { top: 220, bottom: 220, left: 220, right: 220 } },
        },
        children: page,
      })),
    ];
    if (!sections.length)
      throw new UnprocessableEntityException(
        'O item não possui conteúdo renderizável para o preview.',
      );
    return Packer.toBuffer(
      new Document({
        styles: {
          default: { document: { run: { font: 'Calibri', size: 24 } } },
        },
        sections,
      }),
    );
  }

  private async header(env: string, fallback: string): Promise<Buffer> {
    const configured = this.config.get<string>(env);
    const path = resolve(process.cwd(), configured || fallback);
    try {
      return await readFile(path);
    } catch {
      throw new UnprocessableEntityException(
        `Cabeçalho obrigatório ausente: ${env} (${path}).`,
      );
    }
  }

  private object(value: unknown): Json {
    return value && typeof value === 'object' && !Array.isArray(value)
      ? (value as Json)
      : {};
  }

  private stageData(value: unknown): Json {
    const wrapper = this.object(value);
    return Object.prototype.hasOwnProperty.call(wrapper, 'structuredDataJson')
      ? this.object(wrapper.structuredDataJson)
      : wrapper;
  }

  private stageDocument(value: unknown): Json | null {
    const wrapper = this.object(value);
    const document = this.object(wrapper.tiptapAstJson);
    return document.type === 'doc' ? document : null;
  }

  private addEditableStage(
    out: (Paragraph | Table)[],
    title: string,
    raw: unknown,
    structured: Json,
  ): void {
    if (!Object.keys(structured).length) return;
    const document = this.stageDocument(raw);
    if (document) {
      this.addHeading(out, title, 1);
      this.addTiptap(out, document);
    } else this.addStage(out, title, structured);
  }

  private addTiptap(out: (Paragraph | Table)[], document: Json): void {
    if (!document || typeof document !== 'object') return;
    const content = Array.isArray(document.content) ? document.content : [];
    this.renderTiptapNodes(out, content);
  }

  private renderTiptapNodes(
    out: (Paragraph | Table)[],
    nodes: unknown[],
    listContext?: { type: 'bullet' | 'ordered'; depth: number },
  ): void {
    if (!Array.isArray(nodes)) return;

    let orderedIndex = 1;

    for (const raw of nodes) {
      const node = this.object(raw);
      const type = String(node.type ?? '');

      if (type === 'bulletList') {
        const listContent = Array.isArray(node.content) ? node.content : [];
        this.renderTiptapNodes(out, listContent, {
          type: 'bullet',
          depth: (listContext?.depth ?? 0) + 1,
        });
        continue;
      }

      if (type === 'orderedList') {
        const listContent = Array.isArray(node.content) ? node.content : [];
        this.renderTiptapNodes(out, listContent, {
          type: 'ordered',
          depth: (listContext?.depth ?? 0) + 1,
        });
        continue;
      }

      if (type === 'listItem') {
        const depth = listContext?.depth ?? 1;
        const index = listContext?.type === 'ordered' ? orderedIndex++ : 1;
        const prefix = listContext?.type === 'ordered' ? `${index}. ` : '• ';
        this.renderListItem(out, node, prefix, depth);
        continue;
      }

      if (type === 'heading') {
        const attrs = this.object(node.attrs);
        const level = Number(attrs.level) || 1;
        const alignment = this.getAlignment(attrs, AlignmentType.CENTER);
        const runs = this.convertInlineNodesToTextRuns(
          Array.isArray(node.content) ? node.content : [],
          {
            size: level === 1 ? 36 : level === 2 ? 26 : 24,
            defaultBold: true,
            defaultColor: '000000',
          },
        );
        if (runs.length) {
          out.push(
            new Paragraph({
              heading:
                level === 1
                  ? HeadingLevel.HEADING_1
                  : level === 2
                    ? HeadingLevel.HEADING_2
                    : HeadingLevel.HEADING_3,
              alignment,
              children: runs,
              spacing: { before: 240, after: 120 },
            }),
          );
        }
        continue;
      }

      if (type === 'blockquote') {
        this.renderBlockquote(out, node);
        continue;
      }

      if (type === 'table') {
        this.renderTable(out, node);
        continue;
      }

      if (type === 'paragraph') {
        const attrs = this.object(node.attrs);
        const alignment = this.getAlignment(attrs, AlignmentType.JUSTIFIED);
        const runs = this.convertInlineNodesToTextRuns(
          Array.isArray(node.content) ? node.content : [],
          { size: 24, defaultColor: '000000' },
        );
        if (runs.length) {
          out.push(
            new Paragraph({
              alignment,
              spacing: { after: 140, line: 276 },
              children: runs,
            }),
          );
        }
        continue;
      }

      if (Array.isArray(node.content)) {
        this.renderTiptapNodes(out, node.content, listContext);
      }
    }
  }

  private renderListItem(
    out: (Paragraph | Table)[],
    itemNode: Json,
    prefix: string,
    depth: number,
  ): void {
    const itemContent = Array.isArray(itemNode.content) ? itemNode.content : [];
    let isFirstParagraph = true;

    for (const rawChild of itemContent) {
      const child = this.object(rawChild);
      const childType = String(child.type ?? '');

      if (childType === 'paragraph') {
        const attrs = this.object(child.attrs);
        const alignment = this.getAlignment(attrs, AlignmentType.JUSTIFIED);
        const runs = this.convertInlineNodesToTextRuns(
          Array.isArray(child.content) ? child.content : [],
          { size: 24, defaultColor: '000000' },
        );
        const children = isFirstParagraph
          ? [
              new TextRun({
                text: prefix,
                bold: true,
                color: '000000',
                size: 24,
              }),
              ...runs,
            ]
          : runs;

        out.push(
          new Paragraph({
            alignment,
            indent: { left: Math.max(360, depth * 360) },
            spacing: { after: 100, line: 260 },
            children,
          }),
        );
        isFirstParagraph = false;
      } else if (childType === 'bulletList' || childType === 'orderedList') {
        this.renderTiptapNodes(out, [child], {
          type: childType === 'orderedList' ? 'ordered' : 'bullet',
          depth: depth + 1,
        });
      }
    }
  }

  private renderBlockquote(out: (Paragraph | Table)[], quoteNode: Json): void {
    const content = Array.isArray(quoteNode.content) ? quoteNode.content : [];
    for (const rawChild of content) {
      const child = this.object(rawChild);
      const childType = String(child.type ?? '');
      if (childType === 'paragraph') {
        const attrs = this.object(child.attrs);
        const alignment = this.getAlignment(attrs, AlignmentType.JUSTIFIED);
        const runs = this.convertInlineNodesToTextRuns(
          Array.isArray(child.content) ? child.content : [],
          { size: 22, defaultColor: '000000', defaultItalic: true },
        );
        out.push(
          new Paragraph({
            alignment,
            indent: { left: 360, right: 360 },
            shading: { fill: 'F5F5F5' },
            border: {
              left: { color: '000000', style: BorderStyle.SINGLE, size: 24 },
            },
            spacing: { before: 140, after: 140, line: 260 },
            children: runs,
          }),
        );
      } else {
        const runs = this.convertInlineNodesToTextRuns([child], {
          size: 22,
          defaultColor: '000000',
          defaultItalic: true,
        });
        if (runs.length) {
          out.push(
            new Paragraph({
              alignment: AlignmentType.JUSTIFIED,
              indent: { left: 360, right: 360 },
              shading: { fill: 'F5F5F5' },
              border: {
                left: { color: '000000', style: BorderStyle.SINGLE, size: 24 },
              },
              spacing: { before: 140, after: 140, line: 260 },
              children: runs,
            }),
          );
        }
      }
    }
  }

  private renderTable(out: (Paragraph | Table)[], tableNode: Json): void {
    const tableContent = Array.isArray(tableNode.content)
      ? tableNode.content
      : [];
    const rows: TableRow[] = [];

    for (const rawRow of tableContent) {
      const rowNode = this.object(rawRow);
      if (String(rowNode.type ?? '') !== 'tableRow') continue;

      const rowContent = Array.isArray(rowNode.content) ? rowNode.content : [];
      const cells: TableCell[] = [];

      for (const rawCell of rowContent) {
        const cellNode = this.object(rawCell);
        const cellType = String(cellNode.type ?? '');
        if (cellType !== 'tableCell' && cellType !== 'tableHeader') continue;

        const cellContent = Array.isArray(cellNode.content)
          ? cellNode.content
          : [];
        const cellParagraphs: Paragraph[] = [];

        for (const rawPara of cellContent) {
          const paraNode = this.object(rawPara);
          if (String(paraNode.type ?? '') === 'paragraph') {
            const attrs = this.object(paraNode.attrs);
            const alignment = this.getAlignment(attrs, AlignmentType.LEFT);
            const runs = this.convertInlineNodesToTextRuns(
              Array.isArray(paraNode.content) ? paraNode.content : [],
              {
                size: 22,
                defaultColor: '000000',
                defaultBold: cellType === 'tableHeader',
              },
            );
            cellParagraphs.push(
              new Paragraph({
                alignment,
                spacing: { after: 60, line: 240 },
                children: runs.length
                  ? runs
                  : [new TextRun({ text: '', size: 22 })],
              }),
            );
          }
        }

        if (!cellParagraphs.length) {
          cellParagraphs.push(
            new Paragraph({ children: [new TextRun({ text: '', size: 22 })] }),
          );
        }

        cells.push(
          new TableCell({
            children: cellParagraphs,
            shading:
              cellType === 'tableHeader' ? { fill: 'F1F5F9' } : undefined,
            margins: { top: 100, bottom: 100, left: 140, right: 140 },
          }),
        );
      }

      if (cells.length) {
        rows.push(new TableRow({ children: cells }));
      }
    }

    if (rows.length) {
      out.push(
        new Table({
          width: { size: 100, type: WidthType.PERCENTAGE },
          rows,
        }),
      );
    }
  }

  private convertInlineNodesToTextRuns(
    nodes: unknown[],
    options: {
      size?: number;
      defaultColor?: string;
      defaultBold?: boolean;
      defaultItalic?: boolean;
    } = {},
  ): TextRun[] {
    if (!Array.isArray(nodes)) return [];
    const defaultSize = options.size ?? 24;
    const defaultColor = options.defaultColor ?? '000000';
    const defaultBold = options.defaultBold ?? false;
    const defaultItalic = options.defaultItalic ?? false;

    const runs: TextRun[] = [];

    for (const raw of nodes) {
      const node = this.object(raw);
      const type = String(node.type ?? '');

      if (type === 'hardBreak') {
        runs.push(new TextRun({ break: 1 }));
        continue;
      }

      if (type === 'text') {
        const rawText = typeof node.text === 'string' ? node.text : '';
        const text =
          {
            'FUN MECHANICS': 'MECÂNICAS DIVERTIDAS',
            AGES5TO7: 'CRIANÇAS DE 5 A 7 ANOS',
            AGES8TO11: 'CRIANÇAS DE 8 A 11 ANOS',
          }[rawText] ?? rawText;
        if (!text) continue;

        const marks = Array.isArray(node.marks) ? node.marks : [];
        let isBold = defaultBold;
        let isItalic = defaultItalic;
        let isUnderline = false;
        let isStrike = false;
        let isSubScript = false;
        let isSuperScript = false;
        let textColor = defaultColor;
        let highlightFill: string | undefined = undefined;

        for (const rawMark of marks) {
          const mark = this.object(rawMark);
          const mType = String(mark.type ?? '');
          if (mType === 'bold') isBold = true;
          if (mType === 'italic') isItalic = true;
          if (mType === 'underline') isUnderline = true;
          if (mType === 'strike') isStrike = true;
          if (mType === 'subscript') isSubScript = true;
          if (mType === 'superscript') isSuperScript = true;
          if (mType === 'textStyle' || mType === 'color') {
            const attrs = this.object(mark.attrs);
            if (typeof attrs.color === 'string' && attrs.color) {
              textColor = attrs.color.replace(/^#/, '');
            }
          }
          if (mType === 'highlight') {
            const attrs = this.object(mark.attrs);
            if (typeof attrs.color === 'string' && attrs.color) {
              highlightFill = attrs.color.replace(/^#/, '');
            } else {
              highlightFill = 'FFFF00';
            }
          }
        }

        runs.push(
          new TextRun({
            text,
            bold: isBold,
            italics: isItalic,
            underline: isUnderline ? {} : undefined,
            strike: isStrike,
            subScript: isSubScript,
            superScript: isSuperScript,
            color: textColor,
            shading: highlightFill ? { fill: highlightFill } : undefined,
            size: defaultSize,
          }),
        );
      } else if (Array.isArray(node.content)) {
        runs.push(...this.convertInlineNodesToTextRuns(node.content, options));
      }
    }

    return runs;
  }

  private getAlignment(
    nodeAttrs: Json,
    defaultAlignment: Alignment = AlignmentType.JUSTIFIED,
  ): Alignment {
    const align = String(nodeAttrs.textAlign ?? '').toLowerCase();
    if (align === 'center') return AlignmentType.CENTER;
    if (align === 'right') return AlignmentType.RIGHT;
    if (align === 'left') return AlignmentType.LEFT;
    if (align === 'justify') return AlignmentType.JUSTIFIED;
    return defaultAlignment;
  }

  private addHeading(
    out: (Paragraph | Table)[],
    text: string,
    level: 1 | 2,
  ): void {
    out.push(
      new Paragraph({
        heading: level === 1 ? HeadingLevel.HEADING_1 : HeadingLevel.HEADING_2,
        alignment: AlignmentType.CENTER,
        children: [
          new TextRun({
            text: text.toUpperCase(),
            bold: true,
            color: '000000',
            size: level === 1 ? 36 : 26,
          }),
        ],
        spacing: { before: 240, after: 120 },
      }),
    );
  }

  private addBlockquote(out: (Paragraph | Table)[], text: string): void {
    out.push(
      new Paragraph({
        alignment: AlignmentType.JUSTIFIED,
        indent: { left: 360, right: 360 },
        shading: { fill: 'F5F5F5' },
        border: {
          left: { color: '000000', style: BorderStyle.SINGLE, size: 24 },
        },
        spacing: { before: 140, after: 140, line: 260 },
        children: [
          new TextRun({
            text: text,
            italics: true,
            color: '000000',
            size: 22,
          }),
        ],
      }),
    );
  }

  private addText(out: (Paragraph | Table)[], value: unknown): void {
    if (typeof value === 'string' && value.trim()) {
      out.push(
        new Paragraph({
          alignment: AlignmentType.JUSTIFIED,
          spacing: { after: 140, line: 276 },
          children: [
            new TextRun({
              text: value,
              color: '000000',
              size: 24,
            }),
          ],
        }),
      );
    }
  }

  private addField(
    out: (Paragraph | Table)[],
    label: string,
    value: unknown,
  ): void {
    if (typeof value !== 'string' || !value.trim()) return;
    out.push(
      new Paragraph({
        alignment: AlignmentType.JUSTIFIED,
        spacing: { after: 140, line: 276 },
        children: [
          new TextRun({
            text: `${label}: `,
            bold: true,
            color: '000000',
            size: 24,
          }),
          new TextRun({ text: value, color: '000000', size: 24 }),
        ],
      }),
    );
  }

  private addList(
    out: (Paragraph | Table)[],
    label: string,
    value: unknown,
  ): void {
    if (!Array.isArray(value)) return;
    this.addHeading(out, label, 2);
    value.forEach((item) => this.addText(out, `• ${String(item)}`));
  }

  private addQuestions(out: (Paragraph | Table)[], value: unknown): void {
    if (!Array.isArray(value)) return;
    this.addHeading(out, 'PERGUNTAS DA LIÇÃO', 2);
    value.forEach((item, index) => {
      const q = this.object(item);
      this.addText(
        out,
        `${index + 1}. ${String(q.question ?? '')}\nResposta: ${String(q.answer ?? '')}`,
      );
    });
  }

  private addStage(
    out: (Paragraph | Table)[],
    title: string,
    data: Json,
  ): void {
    if (!Object.keys(data).length) return;
    this.addHeading(out, title, 1);
    for (const [key, value] of Object.entries(data)) {
      if (key === 'assets' || key === 'printableAssets') continue;
      if (typeof value === 'string') this.addField(out, key, value);
      else if (
        Array.isArray(value) &&
        value.every((v) => typeof v === 'string')
      )
        this.addList(out, key, value);
    }
  }

  private async landscapeAssetPages(
    entries: Array<{ stage: Json; imageOnly: boolean }>,
  ): Promise<Array<Array<Paragraph | Table>>> {
    const pages: Array<Array<Paragraph | Table>> = [];
    for (const { stage, imageOnly } of entries) {
      const rawAssets = stage.assets ?? stage.printableAssets;
      if (!Array.isArray(rawAssets)) continue;
      for (const raw of rawAssets) {
        const asset = this.object(raw);
        if (typeof asset.url !== 'string') continue;
        const image = await axios.get<ArrayBuffer>(asset.url, {
          responseType: 'arraybuffer',
          timeout: 30000,
        });
        const instruction =
          typeof asset.instruction === 'string' ? asset.instruction.trim() : '';
        const instructionWithoutRepeatedNumber = instruction.replace(
          /^\d+\.\s*/,
          '',
        );
        const stepNumber = Number(asset.stepNumber);
        const displayText = imageOnly
          ? ''
          : instructionWithoutRepeatedNumber
            ? `${Number.isInteger(stepNumber) ? `PASSO ${stepNumber} - ` : ''}${instructionWithoutRepeatedNumber}`
            : typeof asset.displayText === 'string'
              ? asset.displayText.trim()
              : '';
        const visualContent = [
          ...(displayText
            ? [
                new Paragraph({
                  alignment: AlignmentType.CENTER,
                  children: [
                    new TextRun({
                      text: displayText.toLocaleUpperCase('pt-BR'),
                      bold: true,
                      size: 34,
                      color: '111111',
                    }),
                  ],
                  spacing: { before: 0, after: 30 },
                  keepNext: true,
                }),
              ]
            : []),
          new Paragraph({
            alignment: AlignmentType.CENTER,
            children: [
              new ImageRun({
                data: Buffer.from(image.data),
                transformation: {
                  width: displayText ? 984 : 1070,
                  height: displayText ? 620 : 758,
                },
                type: 'png',
              }),
            ],
            spacing: { after: 0 },
          }),
        ];
        pages.push([
          new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            borders: {
              top: { style: BorderStyle.NONE },
              bottom: { style: BorderStyle.NONE },
              left: { style: BorderStyle.NONE },
              right: { style: BorderStyle.NONE },
              insideHorizontal: { style: BorderStyle.NONE },
              insideVertical: { style: BorderStyle.NONE },
            },
            rows: [
              new TableRow({
                cantSplit: true,
                children: [
                  new TableCell({
                    borders: {
                      top: { style: BorderStyle.NONE },
                      bottom: { style: BorderStyle.NONE },
                      left: { style: BorderStyle.NONE },
                      right: { style: BorderStyle.NONE },
                    },
                    margins: { top: 0, bottom: 0, left: 0, right: 0 },
                    children: visualContent,
                  }),
                ],
              }),
            ],
          }),
        ]);
      }
    }
    return pages;
  }

  private async supplementaryPortraitPages(
    younger: Json,
    older: Json,
    manual: Json,
  ): Promise<Array<Array<Paragraph | Table>>> {
    const pages: Array<Array<Paragraph | Table>> = [];
    if (Object.keys(younger).length)
      pages.push(await this.meditationPage(younger, true));
    if (Object.keys(older).length)
      pages.push(await this.meditationPage(older, false));
    if (Object.keys(manual).length)
      pages.push(await this.manualWorkPage(manual));
    return pages;
  }

  private async portraitAssetPages(stage: Json): Promise<Paragraph[][]> {
    const rawAssets = Array.isArray(stage.assets) ? stage.assets : [];
    const pages: Paragraph[][] = [];
    for (const raw of rawAssets) {
      const asset = this.object(raw);
      if (typeof asset.url !== 'string') continue;
      pages.push([
        new Paragraph({
          alignment: AlignmentType.CENTER,
          children: [
            new ImageRun({
              data: await this.downloadImage(asset.url),
              transformation: { width: 760, height: 1074 },
              type: 'png',
            }),
          ],
        }),
      ]);
    }
    return pages;
  }

  private async meditationPage(
    data: Json,
    duplicate: boolean,
  ): Promise<Array<Paragraph | Table>> {
    const logo = await this.header(
      'LESSON_HEADER_RIGHT_PATH',
      '../clubinhonib-app/public/header_direito.png',
    );
    const copy = async (): Promise<Array<Paragraph | Table>> => {
      const out: Array<Paragraph | Table> = [];
      out.push(
        new Table({
          width: { size: 100, type: WidthType.PERCENTAGE },
          rows: [
            new TableRow({
              children: [
                new TableCell({
                  width: { size: 27, type: WidthType.PERCENTAGE },
                  children: [
                    new Paragraph({
                      alignment: AlignmentType.CENTER,
                      children: [
                        new ImageRun({
                          data: logo,
                          transformation: {
                            width: duplicate ? 92 : 112,
                            height: duplicate ? 46 : 56,
                          },
                          type: 'png',
                        }),
                      ],
                    }),
                  ],
                }),
                new TableCell({
                  width: { size: 73, type: WidthType.PERCENTAGE },
                  shading: { fill: '252223' },
                  children: [
                    new Paragraph({
                      alignment: AlignmentType.CENTER,
                      children: [
                        new TextRun({
                          text: duplicate
                            ? 'MEDITAÇÃO PARA CRIANÇAS MENORES'
                            : 'MEDITAÇÃO PARA CRIANÇAS MAIORES',
                          bold: true,
                          color: 'FFFFFF',
                          size: duplicate ? 18 : 22,
                        }),
                      ],
                    }),
                  ],
                }),
              ],
            }),
          ],
        }),
      );
      out.push(
        new Paragraph({
          alignment: AlignmentType.CENTER,
          children: [
            new TextRun({
              text: String(data.title ?? '').toLocaleUpperCase('pt-BR'),
              bold: true,
              size: duplicate ? 17 : 20,
            }),
          ],
          spacing: { after: 25 },
        }),
      );
      out.push(
        new Paragraph({
          children: [
            new TextRun({
              text: 'Nome: __________________________________________   Data: ____/____/____',
              size: duplicate ? 15 : 18,
            }),
          ],
          spacing: { after: 30 },
        }),
      );
      out.push(
        new Paragraph({
          alignment: AlignmentType.CENTER,
          shading: { fill: 'FFF200' },
          children: [
            new TextRun({
              text: 'VERSÍCULO PARA DECORAR',
              bold: true,
              size: duplicate ? 16 : 19,
            }),
          ],
          spacing: { before: 20, after: 20 },
        }),
      );
      out.push(
        new Paragraph({
          alignment: AlignmentType.CENTER,
          border: {
            top: { color: '222222', style: BorderStyle.DASHED, size: 14 },
            bottom: { color: '222222', style: BorderStyle.DASHED, size: 14 },
            left: { color: '222222', style: BorderStyle.DASHED, size: 14 },
            right: { color: '222222', style: BorderStyle.DASHED, size: 14 },
          },
          children: [
            new TextRun({
              text: `“${String(data.verseText ?? '')}” (${String(data.verseReference ?? '')} - NVI)`,
              size: duplicate ? 14 : 17,
            }),
          ],
          spacing: { before: 25, after: 25 },
        }),
      );
      if (!duplicate && typeof data.biblicalText === 'string')
        out.push(
          new Paragraph({
            children: [
              new TextRun({ text: 'TEXTO BÍBLICO: ', bold: true }),
              new TextRun(data.biblicalText),
            ],
          }),
        );
      if (typeof data.introduction === 'string')
        out.push(
          new Paragraph({
            children: [new TextRun(data.introduction)],
            spacing: { after: 40 },
          }),
        );
      const activities = Array.isArray(data.activities) ? data.activities : [];
      const assets = Array.isArray(data.printableAssets)
        ? data.printableAssets
        : [];
      for (let index = 0; index < activities.length; index += 1) {
        const activity = this.object(activities[index]);
        out.push(
          new Paragraph({
            children: [
              new TextRun({
                text: `${index + 1}. ${String(activity.instruction ?? '')}`,
                bold: true,
                size: duplicate ? 14 : 17,
              }),
            ],
            spacing: { before: 30, after: 20 },
          }),
        );
        const asset = this.object(assets[index]);
        if (typeof asset.url === 'string') {
          const image = await this.downloadImage(asset.url);
          out.push(
            new Paragraph({
              alignment: AlignmentType.CENTER,
              children: [
                new ImageRun({
                  data: image,
                  transformation: {
                    width: duplicate ? 150 : 225,
                    height: duplicate ? 88 : 135,
                  },
                  type: 'png',
                }),
              ],
              spacing: { after: 20 },
            }),
          );
        }
      }
      out.push(
        new Paragraph({
          shading: { fill: 'E5E5E5' },
          children: [
            new TextRun({
              text: 'FALANDO COM DEUS: ',
              bold: true,
              color: 'FFFFFF',
              shading: { fill: '686868' },
              size: duplicate ? 15 : 18,
            }),
            new TextRun({
              text: String(data.prayer ?? ''),
              size: duplicate ? 15 : 18,
            }),
          ],
          spacing: { before: 35, after: 35 },
        }),
      );
      return out;
    };
    const framed = (content: Array<Paragraph | Table>): Table =>
      new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        rows: [
          new TableRow({
            children: [
              new TableCell({
                margins: { top: 90, bottom: 90, left: 90, right: 90 },
                borders: {
                  top: { color: '252223', style: BorderStyle.SINGLE, size: 20 },
                  bottom: {
                    color: '252223',
                    style: BorderStyle.SINGLE,
                    size: 20,
                  },
                  left: {
                    color: '252223',
                    style: BorderStyle.SINGLE,
                    size: 20,
                  },
                  right: {
                    color: '252223',
                    style: BorderStyle.SINGLE,
                    size: 20,
                  },
                },
                children: content,
              }),
            ],
          }),
        ],
      });
    const first = framed(await copy());
    if (!duplicate) return [first];
    return [
      first,
      new Paragraph({
        children: [new TextRun('')],
        spacing: { before: 20, after: 20 },
      }),
      framed(await copy()),
    ];
  }

  private async manualWorkPage(data: Json): Promise<Paragraph[]> {
    const assets = Array.isArray(data.printableAssets)
      ? data.printableAssets
      : [];
    const asset = this.object(assets[0]);
    if (typeof asset.url !== 'string') return [];
    const image = await this.downloadImage(asset.url);
    const logo = await this.header(
      'LESSON_HEADER_RIGHT_PATH',
      '../clubinhonib-app/public/header_direito.png',
    );
    const oneCopy = (): Paragraph[] => [
      new Paragraph({
        alignment: AlignmentType.CENTER,
        children: [
          new ImageRun({
            data: logo,
            transformation: { width: 86, height: 43 },
            type: 'png',
          }),
          new TextRun({
            text: '     TRABALHO MANUAL',
            bold: true,
            color: 'FFFFFF',
            shading: { fill: '111111' },
            size: 20,
          }),
        ],
        spacing: { after: 30 },
      }),
      new Paragraph({
        alignment: AlignmentType.CENTER,
        children: [
          new TextRun({
            text: `“${String(data.verseText ?? '')}” (${String(data.verseReference ?? '')} - NVI)`,
            size: 14,
          }),
        ],
        spacing: { after: 30 },
      }),
      new Paragraph({
        alignment: AlignmentType.CENTER,
        children: [
          new ImageRun({
            data: image,
            transformation: { width: 570, height: 318 },
            type: 'png',
          }),
        ],
        spacing: { after: 30 },
      }),
    ];
    return [
      ...oneCopy(),
      new Paragraph({
        children: [new TextRun('')],
        border: {
          bottom: { color: '777777', style: BorderStyle.DASHED, size: 8 },
        },
        spacing: { after: 45 },
      }),
      ...oneCopy(),
    ];
  }

  private async downloadImage(url: string): Promise<Buffer> {
    const image = await axios.get<ArrayBuffer>(url, {
      responseType: 'arraybuffer',
      timeout: 30000,
    });
    return Buffer.from(image.data);
  }
}
