import { buildManualWorkSheet } from '../utils/manual-work-layout.utils';
import { specialPresentationGuide } from '../utils/special-presentation-guide.utils';
import { MANUAL_WORK_LAYOUT } from '../constants/manual-work-layout.constants';
import { editedOlderMeditation } from '../utils/older-meditation-content.utils';
import { buildOlderMeditationSheet } from '../utils/older-meditation-layout.utils';
import { meditationActivityAsset } from '../utils/meditation-assets.utils';
import { Injectable, UnprocessableEntityException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
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
  ExternalHyperlink,
  ParagraphChild,
  WidthType,
} from 'docx';
import { LessonCategory, LessonStageType } from '../enums/lesson.enums';
import {
  documentFontFamily,
  documentFontSize,
  documentLineSpacing,
  documentLink,
  documentTableSpan,
  documentCellWidth,
} from '../lessonDocument.utils';
import type { LessonInlineExportOptions } from '../types/lesson-document.types';
import { YOUNGER_MEDITATION_LAYOUT } from '../constants/younger-meditation-layout.constants';
import { buildYoungerMeditationSheet } from '../utils/younger-meditation-layout.utils';
import { editedYoungerMeditation } from '../utils/younger-meditation-content.utils';
import {
  downloadSafeImageBuffer,
  type SafeImageDownloadOptions,
} from '../utils/asset-url.utils';
import { reconcileStageStructuredContent } from '../utils/lesson-canonical-content.utils';
import {
  lessonHeaderLines,
  lessonString,
  lessonStoryHeading,
  normalizeLessonVerseReference,
  normalizeLessonDocumentHeader,
} from '../utils';

type Json = Record<string, unknown>;
type Alignment = (typeof AlignmentType)[keyof typeof AlignmentType];

@Injectable()
export class DocxExporterService {
  private downloadOptions: SafeImageDownloadOptions = {};

  constructor(private readonly config: ConfigService) {}

  setDownloadOptions(options: SafeImageDownloadOptions): void {
    this.downloadOptions = options;
  }

  async buildDocxFromTiptapOrStructuredJson(
    input: Json,
    weekNumber?: number | null,
    category?: LessonCategory | null,
  ): Promise<Buffer> {
    const children: (Paragraph | Table)[] = [];
    const lesson = this.stageData(input[LessonStageType.LESSON]);
    const lessonDoc = this.stageDocument(input[LessonStageType.LESSON]);
    if (Object.keys(lesson).length || lessonDoc) {
      if (lessonDoc) {
        this.addTiptap(
          children,
          normalizeLessonDocumentHeader(lessonDoc, weekNumber, category),
        );
      } else {
        lessonHeaderLines(
          lessonString(lesson.title),
          weekNumber,
          category,
        ).forEach((line) => this.addHeading(children, line, 1));
        this.addField(children, 'TEXTO BÍBLICO', lesson.biblicalReference);
        this.addField(children, 'PROPÓSITO', lesson.purpose);
        this.addList(children, 'MÚSICAS', lesson.songs);
        const verse = this.object(lesson.memoryVerse);
        this.addHeading(children, 'VERSÍCULO PARA MEMORIZAR', 2);
        this.addText(
          children,
          `${lessonString(verse.text)} — ${normalizeLessonVerseReference(verse.reference)} — ${lessonString(verse.version)}`,
        );
        this.addField(
          children,
          'EXPLICAÇÃO DO PRINCÍPIO',
          lesson.principleExplanation,
        );
        this.addHeading(children, 'LIÇÃO BÍBLICA', 2);
        for (const line of lessonString(lesson.story)
          .split(/\r?\n/)
          .map((text) => text.trim())
          .filter(Boolean)) {
          const title = lessonStoryHeading(line);
          if (title)
            this.renderTiptapNodes(children, [
              {
                type: 'heading',
                attrs: { level: 3, textAlign: 'left' },
                content: [{ type: 'text', text: title }],
              },
            ]);
          else this.addText(children, line);
        }
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
    if (category === LessonCategory.SPECIAL) {
      children.push(...specialPresentationGuide(visualStage.assets));
    }
    const rawGameData = this.stageData(input[LessonStageType.STANDARD_GAME]);
    const gameStage = reconcileStageStructuredContent(
      LessonStageType.STANDARD_GAME,
      rawGameData,
      rawGameData,
      this.stageDocument(input[LessonStageType.STANDARD_GAME]),
    );
    const verseVisualStage = this.stageData(
      input[LessonStageType.VERSE_VISUALS],
    );
    const rawFixationData = this.stageData(
      input[LessonStageType.VERSE_FIXATION],
    );
    const fixationStage = reconcileStageStructuredContent(
      LessonStageType.VERSE_FIXATION,
      rawFixationData,
      rawFixationData,
      this.stageDocument(input[LessonStageType.VERSE_FIXATION]),
    );
    const youngerMeditation = editedYoungerMeditation(
      this.stageData(input[LessonStageType.MEDITATION_YOUNGER]),
      this.stageDocument(input[LessonStageType.MEDITATION_YOUNGER]),
    );
    const youngerDocument = this.stageDocument(
      input[LessonStageType.MEDITATION_YOUNGER],
    );
    if (
      youngerDocument &&
      (!Array.isArray(youngerMeditation.activities) ||
        !youngerMeditation.activities.length)
    ) {
      this.addTiptap(children, youngerDocument);
      for (const key of Object.keys(youngerMeditation))
        delete youngerMeditation[key];
    }
    const olderMeditation = editedOlderMeditation(
      this.stageData(input[LessonStageType.MEDITATION_OLDER]),
      this.stageDocument(input[LessonStageType.MEDITATION_OLDER]),
    );
    const olderDocument = this.stageDocument(
      input[LessonStageType.MEDITATION_OLDER],
    );
    if (
      olderDocument &&
      (!Array.isArray(olderMeditation.activities) ||
        !olderMeditation.activities.length)
    ) {
      this.addTiptap(children, olderDocument);
      for (const key of Object.keys(olderMeditation))
        delete olderMeditation[key];
    }
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

    const [left, right] = children.length
      ? await Promise.all([
          this.header(
            'LESSON_HEADER_LEFT_PATH',
            '../clubinhonib-app/public/header_esquerdo.png',
          ),
          this.header(
            'LESSON_HEADER_RIGHT_PATH',
            '../clubinhonib-app/public/header_direito.png',
          ),
        ])
      : [Buffer.alloc(0), Buffer.alloc(0)];
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
      ...supplementaryPages.map((page, index) => ({
        properties: {
          page:
            index <
            Number(Boolean(Object.keys(youngerMeditation).length)) +
              Number(Boolean(Object.keys(olderMeditation).length))
              ? {
                  size: {
                    width: YOUNGER_MEDITATION_LAYOUT.pageWidth,
                    height: YOUNGER_MEDITATION_LAYOUT.pageHeight,
                  },
                  margin: {
                    top: YOUNGER_MEDITATION_LAYOUT.margin,
                    bottom: YOUNGER_MEDITATION_LAYOUT.margin,
                    left: YOUNGER_MEDITATION_LAYOUT.margin,
                    right: YOUNGER_MEDITATION_LAYOUT.margin,
                  },
                }
              : {
                  size: {
                    width: MANUAL_WORK_LAYOUT.pageWidth,
                    height: MANUAL_WORK_LAYOUT.pageHeight,
                  },
                  margin: {
                    top: MANUAL_WORK_LAYOUT.margin,
                    bottom: MANUAL_WORK_LAYOUT.margin,
                    left: MANUAL_WORK_LAYOUT.margin,
                    right: MANUAL_WORK_LAYOUT.margin,
                  },
                },
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
    const document = this.stageDocument(raw);
    if (!Object.keys(structured).length && !document) return;
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
      const type = lessonString(node.type);

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
              spacing: documentLineSpacing(attrs, { before: 240, after: 120 }),
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

      if (type === 'horizontalRule') {
        out.push(
          new Paragraph({
            border: {
              bottom: { color: 'DDDDDD', style: BorderStyle.SINGLE, size: 6 },
            },
          }),
        );
        continue;
      }
      if (type === 'paragraph' || type === 'codeBlock') {
        const attrs = this.object(node.attrs);
        const alignment = this.getAlignment(attrs, AlignmentType.JUSTIFIED);
        const runs = this.convertInlineNodesToTextRuns(
          Array.isArray(node.content) ? node.content : [],
          {
            size: 24,
            defaultColor: '000000',
            defaultFont: type === 'codeBlock' ? 'Courier New' : undefined,
          },
        );
        if (runs.length || type === 'paragraph') {
          out.push(
            new Paragraph({
              alignment,
              spacing: documentLineSpacing(attrs, { after: 140, line: 276 }),
              children: runs.length ? runs : [new TextRun('')],
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
      const childType = lessonString(child.type);

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
            spacing: documentLineSpacing(attrs, { after: 100, line: 260 }),
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
      const childType = lessonString(child.type);
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
            spacing: documentLineSpacing(attrs, {
              before: 140,
              after: 140,
              line: 260,
            }),
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
      if (lessonString(rowNode.type) !== 'tableRow') continue;

      const rowContent = Array.isArray(rowNode.content) ? rowNode.content : [];
      const cells: TableCell[] = [];

      for (const rawCell of rowContent) {
        const cellNode = this.object(rawCell);
        const cellType = lessonString(cellNode.type);
        if (cellType !== 'tableCell' && cellType !== 'tableHeader') continue;

        const cellContent = Array.isArray(cellNode.content)
          ? cellNode.content
          : [];
        const cellParagraphs: (Paragraph | Table)[] = [];

        for (const rawPara of cellContent) {
          const paraNode = this.object(rawPara);
          if (lessonString(paraNode.type) === 'paragraph') {
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
                spacing: documentLineSpacing(attrs, { after: 60, line: 240 }),
                children: runs.length
                  ? runs
                  : [new TextRun({ text: '', size: 22 })],
              }),
            );
          } else {
            this.renderTiptapNodes(cellParagraphs, [paraNode]);
          }
        }

        if (!cellParagraphs.length) {
          cellParagraphs.push(
            new Paragraph({ children: [new TextRun({ text: '', size: 22 })] }),
          );
        }

        const cellWidth = documentCellWidth(
          this.object(cellNode.attrs).colwidth,
        );
        cells.push(
          new TableCell({
            children: cellParagraphs,
            columnSpan: documentTableSpan(this.object(cellNode.attrs).colspan),
            rowSpan: documentTableSpan(this.object(cellNode.attrs).rowspan),
            width: cellWidth
              ? { size: cellWidth, type: WidthType.DXA }
              : undefined,
            shading:
              cellType === 'tableHeader' ? { fill: 'F1F5F9' } : undefined,
            margins: { top: 100, bottom: 100, left: 140, right: 140 },
          }),
        );
      }

      rows.push(new TableRow({ children: cells }));
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
    options: LessonInlineExportOptions = {},
  ): ParagraphChild[] {
    if (!Array.isArray(nodes)) return [];
    const defaultSize = options.size ?? 24;
    const defaultColor = options.defaultColor ?? '000000';
    const defaultBold = options.defaultBold ?? false;
    const defaultItalic = options.defaultItalic ?? false;

    const runs: ParagraphChild[] = [];

    for (const raw of nodes) {
      const node = this.object(raw);
      const type = lessonString(node.type);

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
        let font = options.defaultFont;
        let size = defaultSize;
        let href: string | undefined;
        let highlightFill: string | undefined = undefined;

        for (const rawMark of marks) {
          const mark = this.object(rawMark);
          const mType = lessonString(mark.type);
          if (mType === 'link')
            href = documentLink(this.object(mark.attrs).href);
          if (mType === 'code') font = 'Courier New';
          if (mType === 'bold') isBold = true;
          if (mType === 'italic') isItalic = true;
          if (mType === 'underline') isUnderline = true;
          if (mType === 'strike') isStrike = true;
          if (mType === 'subscript') isSubScript = true;
          if (mType === 'superscript') isSuperScript = true;
          if (mType === 'textStyle' || mType === 'color') {
            const attrs = this.object(mark.attrs);
            font = documentFontFamily(attrs.fontFamily) ?? font;
            size = documentFontSize(attrs.fontSize) ?? size;
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

        const run = new TextRun({
          text,
          bold: isBold,
          italics: isItalic,
          underline: isUnderline || href ? {} : undefined,
          strike: isStrike,
          subScript: isSubScript,
          superScript: isSuperScript,
          color: href && textColor === defaultColor ? '0563C1' : textColor,
          shading: highlightFill ? { fill: highlightFill } : undefined,
          size,
          font,
        });
        runs.push(
          href ? new ExternalHyperlink({ link: href, children: [run] }) : run,
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
    const align = lessonString(nodeAttrs.textAlign).toLowerCase();
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
        `${index + 1}. ${lessonString(q.question)}\nResposta: ${lessonString(q.answer)}`,
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
      if (key === 'assets' || key === 'printableAssets' || key.startsWith('_'))
        continue;
      if (typeof value === 'string') this.addField(out, key, value);
      else if (
        Array.isArray(value) &&
        value.every((v) => typeof v === 'string')
      )
        this.addList(out, key, value);
    }
  }

  /** Legendas do kit de recortes: nomes dos elementos aplicados pelo renderer, nunca embutidos na imagem. */
  private cutoutLegend(asset: Json): string {
    if (!Array.isArray(asset.items)) return '';
    return asset.items
      .map((item) => this.object(item).label)
      .filter((label): label is string => typeof label === 'string' && !!label.trim())
      .map((label, index) => `${index + 1}. ${label.trim()}`)
      .join('   ');
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
        const image = await this.downloadImage(asset.url);
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
        const legend = imageOnly ? '' : this.cutoutLegend(asset);
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
                data: image,
                transformation: {
                  width: displayText || legend ? 984 : 1070,
                  height: displayText || legend ? 620 : 758,
                },
                type: 'png',
              }),
            ],
            spacing: { after: 0 },
          }),
          ...(legend
            ? [
                new Paragraph({
                  alignment: AlignmentType.CENTER,
                  children: [
                    new TextRun({ text: legend, size: 20, color: '333333' }),
                  ],
                  spacing: { before: 40, after: 0 },
                }),
              ]
            : []),
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
    if (duplicate) {
      const assets = Array.isArray(data.printableAssets)
        ? data.printableAssets
        : [];
      const activities = Array.isArray(data.activities) ? data.activities : [];
      const logo = await this.header(
        'MEDITATION_HEADER_LEFT_PATH',
        YOUNGER_MEDITATION_LAYOUT.logoPath,
      );
      const sheetActivities = await Promise.all(
        activities.slice(0, 2).map(async (raw, index) => {
          const activity = this.object(raw);
          const asset = meditationActivityAsset(
            assets,
            index,
            activities.length,
          );
          return {
            instruction: lessonString(activity.instruction),
            ...(typeof asset.url === 'string'
              ? { image: await this.downloadImage(asset.url) }
              : {}),
          };
        }),
      );
      return buildYoungerMeditationSheet({
        title: lessonString(data.title),
        verse: `“${lessonString(data.verseText)}” (${normalizeLessonVerseReference(data.verseReference)})`,
        prayer: lessonString(data.prayer),
        logo,
        document: this.object(data.meditationDocument),
        activities: sheetActivities,
      });
    }
    const assets = Array.isArray(data.printableAssets)
      ? data.printableAssets
      : [];
    const activities = Array.isArray(data.activities) ? data.activities : [];
    const logo = await this.header(
      'MEDITATION_HEADER_LEFT_PATH',
      YOUNGER_MEDITATION_LAYOUT.logoPath,
    );
    const sheetActivities = await Promise.all(
      activities.slice(0, 3).map(async (raw, index) => {
        const asset = meditationActivityAsset(assets, index, activities.length);
        return {
          instruction: lessonString(this.object(raw).instruction),
          ...(typeof asset.url === 'string'
            ? { image: await this.downloadImage(asset.url) }
            : {}),
        };
      }),
    );
    return buildOlderMeditationSheet({
      title: lessonString(data.title),
      verse: `“${lessonString(data.verseText)}”\n${normalizeLessonVerseReference(data.verseReference)} — NVI`,
      biblicalText: lessonString(data.biblicalText),
      introduction: lessonString(data.introduction),
      prayer: lessonString(data.prayer),
      logo,
      document: this.object(data.meditationDocument),
      activities: sheetActivities,
    });
  }

  private async manualWorkPage(data: Json): Promise<Array<Paragraph | Table>> {
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
    return buildManualWorkSheet(
      image,
      logo,
      `“${lessonString(data.verseText)}” (${lessonString(data.verseReference)} - NVI)`,
    );
  }

  private async downloadImage(url: string): Promise<Buffer> {
    const bucketName =
      this.downloadOptions.bucketName ??
      this.config?.get<string>('AWS_S3_BUCKET_NAME') ??
      undefined;
    return downloadSafeImageBuffer(url, {
      ...this.downloadOptions,
      bucketName,
    });
  }
}
