import { buildManualWorkSheet } from '../utils/manual-work-layout.utils';
import { specialPresentationGuide } from '../utils/special-presentation-guide.utils';
import { MANUAL_WORK_LAYOUT } from '../constants/manual-work-layout.constants';
import { editedOlderMeditation } from '../utils/older-meditation-content.utils';
import { buildOlderMeditationSheet } from '../utils/older-meditation-layout.utils';
import { meditationActivityAsset } from '../utils/meditation-assets.utils';
import {
  Injectable,
  Logger,
  OnApplicationBootstrap,
  Optional,
  UnprocessableEntityException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { readFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { AwsS3Service } from 'src/shared/providers/aws/aws-s3.service';
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
import type {
  LessonAssetPageEntry,
  LessonDocumentBlock,
  LessonImageLoader,
  LessonInlineExportOptions,
  LessonListContext,
} from '../types/lesson-document.types';
import {
  DEFAULT_MAX_IMAGE_ASSET_BYTES,
  IMAGE_DOWNLOAD_CONCURRENCY,
} from '../constants/asset-download.constants';
import {
  DOCUMENT_BASE_FONT,
  DOCUMENT_CODE_FONT,
  DOCUMENT_DEFAULT_COLOR,
  DOCUMENT_DEFAULT_FONT_SIZE,
  DOCUMENT_DEFAULT_HIGHLIGHT,
  DOCUMENT_IMAGE_BOXES,
  DOCUMENT_LINK_COLOR,
  DOCUMENT_LIST_INDENT,
  LEGACY_DOCUMENT_LABELS,
  OLDER_MEDITATION_MAX_ACTIVITIES,
  YOUNGER_MEDITATION_MAX_ACTIVITIES,
} from '../constants/lesson-document.constants';
import {
  LESSON_HEADER_ASSETS_DIRECTORY,
  LESSON_HEADER_IMAGES,
  LessonHeaderImage,
} from '../constants/lesson-header.constants';
import { LessonVisualOrientation } from '../enums/lesson.enums';
import { createConcurrencyLimiter } from '../utils/concurrency.utils';
import {
  docxTextLines,
  normalizeDocxColor,
  sanitizeDocxText,
} from '../utils/docx-text.utils';
import { fitImageInBox } from '../utils/image-dimensions.utils';
import { YOUNGER_MEDITATION_LAYOUT } from '../constants/younger-meditation-layout.constants';
import { buildYoungerMeditationSheet } from '../utils/younger-meditation-layout.utils';
import { editedYoungerMeditation } from '../utils/younger-meditation-content.utils';
import { downloadSafeImageBuffer } from '../utils/asset-url.utils';
import { reconcileStageStructuredContent } from '../utils/lesson-canonical-content.utils';
import { isGameSummaryAssetList } from '../utils/lesson-game-summary.utils';
import { withoutLeakedImageBrief } from '../utils/lesson-image-brief-document.utils';
import {
  lessonHeaderLines,
  lessonString,
  lessonStoryHeading,
  normalizeLessonVerseReference,
  unquoteLessonVerse,
  normalizeLessonDocumentHeader,
} from '../utils';

type Json = Record<string, unknown>;
type Alignment = (typeof AlignmentType)[keyof typeof AlignmentType];

@Injectable()
export class DocxExporterService implements OnApplicationBootstrap {
  private readonly logger = new Logger(DocxExporterService.name);
  /** Shared by every document being built, so exports cannot flood the network. */
  private readonly limitDownload = createConcurrencyLimiter(
    IMAGE_DOWNLOAD_CONCURRENCY,
  );

  constructor(
    private readonly config: ConfigService,
    @Optional() private readonly s3?: AwsS3Service,
  ) {}

  /** A missing header only fails the export; warn at boot so it is noticed earlier. */
  async onApplicationBootstrap(): Promise<void> {
    for (const image of Object.values(LessonHeaderImage)) {
      try {
        await this.header(image);
      } catch {
        this.logger.warn(
          `Cabeçalho ${LESSON_HEADER_IMAGES[image].env} indisponível: a exportação de PDF do Estúdio falhará até que o arquivo exista.`,
        );
      }
    }
  }

  async buildDocxFromTiptapOrStructuredJson(
    input: Json,
    weekNumber?: number | null,
    category?: LessonCategory | null,
  ): Promise<Buffer> {
    const children: (Paragraph | Table)[] = [];
    const loadImage = this.createImageLoader();
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
          this.header(LessonHeaderImage.LESSON_LEFT),
          this.header(LessonHeaderImage.LESSON_RIGHT),
        ])
      : [Buffer.alloc(0), Buffer.alloc(0)];
    const leftHeader = fitImageInBox(left, DOCUMENT_IMAGE_BOXES.headerLeft);
    const rightHeader = fitImageInBox(right, DOCUMENT_IMAGE_BOXES.headerRight);
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
                      transformation: {
                        width: leftHeader.width,
                        height: leftHeader.height,
                      },
                      type: leftHeader.type,
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
                      transformation: {
                        width: rightHeader.width,
                        height: rightHeader.height,
                      },
                      type: rightHeader.type,
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
    const portraitVisuals =
      visualConfig.orientation === String(LessonVisualOrientation.PORTRAIT);
    // The compiled fun-game infographic is a portrait page; older games keep
    // one landscape page per step.
    const gameSummary = isGameSummaryAssetList(gameStage.assets);
    const [
      storyLandscapePages,
      gamePages,
      verseCardPages,
      laterLandscapePages,
      portraitVisualPages,
      supplementaryPages,
    ] = await Promise.all([
      this.landscapeAssetPages(
        portraitVisuals ? [] : [{ stage: visualStage, imageOnly: true }],
        loadImage,
      ),
      gameSummary
        ? this.portraitAssetPages(gameStage, loadImage)
        : this.landscapeAssetPages(
            [{ stage: gameStage, imageOnly: false }],
            loadImage,
          ),
      // Verse cards are full-bleed: the art reaches every edge of the sheet.
      this.bleedLandscapePages(verseVisualStage, loadImage),
      this.landscapeAssetPages(
        [{ stage: fixationStage, imageOnly: false }],
        loadImage,
      ),
      portraitVisuals
        ? this.portraitAssetPages(visualStage, loadImage)
        : Promise.resolve([]),
      this.supplementaryPortraitPages(
        youngerMeditation,
        olderMeditation,
        manualWork,
        loadImage,
      ),
    ]);
    const landscapeSection = (page: LessonDocumentBlock[]) => ({
      properties: {
        page: {
          size: { orientation: PageOrientation.LANDSCAPE },
          margin: { top: 120, bottom: 120, left: 120, right: 120 },
        },
      },
      children: page,
    });
    const bleedSection = (page: LessonDocumentBlock[]) => ({
      properties: {
        page: {
          size: { orientation: PageOrientation.LANDSCAPE },
          margin: {
            top: 0,
            bottom: 0,
            left: 0,
            right: 0,
            header: 0,
            footer: 0,
          },
        },
      },
      children: page,
    });
    const portraitSection = (page: LessonDocumentBlock[]) => ({
      properties: {
        page: { margin: { top: 120, bottom: 120, left: 120, right: 120 } },
      },
      children: page,
    });
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
      ...storyLandscapePages.map(landscapeSection),
      ...gamePages.map(gameSummary ? portraitSection : landscapeSection),
      ...verseCardPages.map(bleedSection),
      ...laterLandscapePages.map(landscapeSection),
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
          default: {
            document: {
              run: {
                font: DOCUMENT_BASE_FONT,
                size: DOCUMENT_DEFAULT_FONT_SIZE,
              },
            },
          },
        },
        sections,
      }),
    );
  }

  /**
   * Header artwork: the configured override when present, otherwise the copy
   * packaged with the API, otherwise the legacy sibling frontend checkout.
   */
  private async header(image: LessonHeaderImage): Promise<Buffer> {
    const { env, file, legacyPath } = LESSON_HEADER_IMAGES[image];
    const configured = this.config.get<string>(env);
    const candidates = configured
      ? [resolve(process.cwd(), configured)]
      : [
          join(LESSON_HEADER_ASSETS_DIRECTORY, file),
          resolve(process.cwd(), legacyPath),
        ];
    for (const path of candidates) {
      try {
        return await readFile(path);
      } catch {
        // try the next candidate
      }
    }
    this.logger.error(
      `Cabeçalho ${env} não encontrado em: ${candidates.join(', ')}`,
    );
    throw new UnprocessableEntityException(
      `Cabeçalho obrigatório ausente (${env}). Avise o suporte técnico.`,
    );
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
    const document = withoutLeakedImageBrief(
      this.object(wrapper.tiptapAstJson),
    );
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
    listContext?: LessonListContext,
  ): void {
    if (!Array.isArray(nodes)) return;

    let orderedIndex = listContext?.start ?? 1;

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
        const start = Number(this.object(node.attrs).start);
        this.renderTiptapNodes(out, listContent, {
          type: 'ordered',
          depth: (listContext?.depth ?? 0) + 1,
          start: Number.isInteger(start) && start > 0 ? start : 1,
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
            size: DOCUMENT_DEFAULT_FONT_SIZE,
            defaultColor: DOCUMENT_DEFAULT_COLOR,
            defaultFont: type === 'codeBlock' ? DOCUMENT_CODE_FONT : undefined,
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

  /**
   * Renders every block of a list item. The marker is prepended to the first
   * paragraph; any other block (heading, quote, code, table) is rendered with
   * the regular block renderer instead of being dropped.
   */
  private renderListItem(
    out: (Paragraph | Table)[],
    itemNode: Json,
    prefix: string,
    depth: number,
  ): void {
    const itemContent = Array.isArray(itemNode.content) ? itemNode.content : [];
    const indent = { left: Math.max(1, depth) * DOCUMENT_LIST_INDENT };
    let markerPending = true;
    const marker = (): TextRun =>
      new TextRun({
        text: prefix,
        bold: true,
        color: DOCUMENT_DEFAULT_COLOR,
        size: DOCUMENT_DEFAULT_FONT_SIZE,
      });

    for (const rawChild of itemContent) {
      const child = this.object(rawChild);
      const childType = lessonString(child.type);

      if (childType === 'paragraph') {
        const attrs = this.object(child.attrs);
        const alignment = this.getAlignment(attrs, AlignmentType.JUSTIFIED);
        const runs = this.convertInlineNodesToTextRuns(
          Array.isArray(child.content) ? child.content : [],
          {
            size: DOCUMENT_DEFAULT_FONT_SIZE,
            defaultColor: DOCUMENT_DEFAULT_COLOR,
          },
        );
        out.push(
          new Paragraph({
            alignment,
            indent,
            spacing: documentLineSpacing(attrs, { after: 100, line: 260 }),
            children: markerPending ? [marker(), ...runs] : runs,
          }),
        );
        markerPending = false;
        continue;
      }

      if (markerPending) {
        out.push(new Paragraph({ indent, children: [marker()] }));
        markerPending = false;
      }
      if (childType === 'bulletList' || childType === 'orderedList') {
        // The list branch adds one level itself; passing `depth` avoids doubling.
        this.renderTiptapNodes(out, [child], { type: 'bullet', depth });
      } else {
        this.renderTiptapNodes(out, [child]);
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
    const defaultSize = options.size ?? DOCUMENT_DEFAULT_FONT_SIZE;
    const defaultColor = options.defaultColor ?? DOCUMENT_DEFAULT_COLOR;
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
        const text = sanitizeDocxText(
          LEGACY_DOCUMENT_LABELS[rawText] ?? rawText,
        );
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
          if (mType === 'code') font = DOCUMENT_CODE_FONT;
          if (mType === 'bold') isBold = true;
          if (mType === 'italic') isItalic = true;
          if (mType === 'underline') isUnderline = true;
          if (mType === 'strike') isStrike = true;
          if (mType === 'subscript') isSubScript = true;
          if (mType === 'superscript') isSuperScript = true;
          if (mType === 'textStyle' || mType === 'color') {
            const attrs = this.object(mark.attrs);
            font = documentFontFamily(attrs.fontFamily) ?? font;
            size = documentFontSize(attrs.fontSize, defaultSize) ?? size;
            // Pasted content may carry rgb()/named colours; an unparseable
            // value keeps the default instead of breaking the whole document.
            textColor = normalizeDocxColor(attrs.color) ?? textColor;
          }
          if (mType === 'highlight') {
            highlightFill =
              normalizeDocxColor(this.object(mark.attrs).color) ??
              DOCUMENT_DEFAULT_HIGHLIGHT;
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
          color:
            href && textColor === defaultColor
              ? DOCUMENT_LINK_COLOR
              : textColor,
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

  /** One sanitised run per line, so `\n` in structured text becomes a real break. */
  private plainRuns(
    value: string,
    options: {
      bold?: boolean;
      italics?: boolean;
      size?: number;
      color?: string;
    } = {},
  ): TextRun[] {
    return docxTextLines(value).map(
      (line, index) =>
        new TextRun({
          text: line,
          ...(index ? { break: 1 } : {}),
          bold: options.bold,
          italics: options.italics,
          color: options.color ?? DOCUMENT_DEFAULT_COLOR,
          size: options.size ?? DOCUMENT_DEFAULT_FONT_SIZE,
        }),
    );
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
        children: this.plainRuns(text.toUpperCase(), {
          bold: true,
          size: level === 1 ? 36 : 26,
        }),
        spacing: { before: 240, after: 120 },
      }),
    );
  }

  private addText(out: (Paragraph | Table)[], value: unknown): void {
    if (typeof value === 'string' && value.trim()) {
      out.push(
        new Paragraph({
          alignment: AlignmentType.JUSTIFIED,
          spacing: { after: 140, line: 276 },
          children: this.plainRuns(value),
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
          ...this.plainRuns(`${label}: `, { bold: true }),
          ...this.plainRuns(value),
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
      .filter(
        (label): label is string => typeof label === 'string' && !!label.trim(),
      )
      .map((label, index) => `${index + 1}. ${label.trim()}`)
      .join('   ');
  }

  /** Assets of a stage, each with the URL the generation must have stored. */
  private requiredAssets(rawAssets: unknown): Json[] {
    if (!Array.isArray(rawAssets)) return [];
    return rawAssets.map((raw) => {
      const asset = this.object(raw);
      if (typeof asset.url !== 'string' || !asset.url.trim())
        throw new UnprocessableEntityException(
          'Uma imagem obrigatória deste item ainda não foi gerada. Gere o item novamente antes de exportar.',
        );
      return asset;
    });
  }

  private async landscapeAssetPages(
    entries: LessonAssetPageEntry[],
    loadImage: LessonImageLoader,
  ): Promise<LessonDocumentBlock[][]> {
    const items = entries.flatMap(({ stage, imageOnly }) =>
      this.requiredAssets(stage.assets ?? stage.printableAssets).map(
        (asset) => ({ asset, imageOnly }),
      ),
    );
    return Promise.all(
      items.map(async ({ asset, imageOnly }) =>
        this.landscapeAssetPage(
          asset,
          imageOnly,
          await loadImage(String(asset.url)),
        ),
      ),
    );
  }

  private landscapeAssetPage(
    asset: Json,
    imageOnly: boolean,
    image: Buffer,
  ): LessonDocumentBlock[] {
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
    const fitted = fitImageInBox(
      image,
      displayText || legend
        ? DOCUMENT_IMAGE_BOXES.landscapeWithText
        : DOCUMENT_IMAGE_BOXES.landscapeFull,
    );
    const visualContent = [
      ...(displayText
        ? [
            new Paragraph({
              alignment: AlignmentType.CENTER,
              children: this.plainRuns(displayText.toLocaleUpperCase('pt-BR'), {
                bold: true,
                size: 34,
                color: '111111',
              }),
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
            transformation: { width: fitted.width, height: fitted.height },
            type: fitted.type,
          }),
        ],
        spacing: { after: 0 },
      }),
      ...(legend
        ? [
            new Paragraph({
              alignment: AlignmentType.CENTER,
              children: this.plainRuns(legend, { size: 20, color: '333333' }),
              spacing: { before: 40, after: 0 },
            }),
          ]
        : []),
    ];
    return [
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
    ];
  }

  private async supplementaryPortraitPages(
    younger: Json,
    older: Json,
    manual: Json,
    loadImage: LessonImageLoader,
  ): Promise<LessonDocumentBlock[][]> {
    const [youngerPage, olderPage, manualPage] = await Promise.all([
      Object.keys(younger).length
        ? this.youngerMeditationPage(younger, loadImage)
        : null,
      Object.keys(older).length
        ? this.olderMeditationPage(older, loadImage)
        : null,
      Object.keys(manual).length
        ? this.manualWorkPage(manual, loadImage)
        : null,
    ]);
    return [youngerPage, olderPage, manualPage].filter(
      (page): page is LessonDocumentBlock[] => page !== null,
    );
  }

  /** One verse card per landscape sheet, edge to edge, with no white margin. */
  private async bleedLandscapePages(
    stage: Json,
    loadImage: LessonImageLoader,
  ): Promise<Paragraph[][]> {
    return Promise.all(
      this.requiredAssets(stage.assets ?? stage.printableAssets).map(
        async (asset) => {
          const image = await loadImage(String(asset.url));
          const fitted = fitImageInBox(
            image,
            DOCUMENT_IMAGE_BOXES.landscapeBleed,
          );
          return [
            new Paragraph({
              alignment: AlignmentType.CENTER,
              spacing: { before: 0, after: 0, line: 240 },
              children: [
                new ImageRun({
                  data: image,
                  transformation: {
                    width: fitted.width,
                    height: fitted.height,
                  },
                  type: fitted.type,
                }),
              ],
            }),
          ];
        },
      ),
    );
  }

  private async portraitAssetPages(
    stage: Json,
    loadImage: LessonImageLoader,
  ): Promise<Paragraph[][]> {
    return Promise.all(
      this.requiredAssets(stage.assets).map(async (asset) => {
        const image = await loadImage(String(asset.url));
        const fitted = fitImageInBox(image, DOCUMENT_IMAGE_BOXES.portraitFull);
        return [
          new Paragraph({
            alignment: AlignmentType.CENTER,
            children: [
              new ImageRun({
                data: image,
                transformation: { width: fitted.width, height: fitted.height },
                type: fitted.type,
              }),
            ],
          }),
        ];
      }),
    );
  }

  /** Activities of a meditation sheet with their optional artwork. */
  private async meditationActivities(
    data: Json,
    maximum: number,
    loadImage: LessonImageLoader,
  ): Promise<Array<{ instruction: string; image?: Buffer }>> {
    const assets = Array.isArray(data.printableAssets)
      ? data.printableAssets
      : [];
    const activities = Array.isArray(data.activities) ? data.activities : [];
    if (activities.length > maximum)
      throw new UnprocessableEntityException(
        `A folha comporta no máximo ${maximum} atividades, mas o item possui ${activities.length}. Remova as excedentes ou gere o item novamente.`,
      );
    return Promise.all(
      activities.map(async (raw, index) => {
        const asset = meditationActivityAsset(assets, index, activities.length);
        return {
          instruction: lessonString(this.object(raw).instruction),
          ...(typeof asset.url === 'string' && asset.url.trim()
            ? { image: await loadImage(asset.url) }
            : {}),
        };
      }),
    );
  }

  private async youngerMeditationPage(
    data: Json,
    loadImage: LessonImageLoader,
  ): Promise<LessonDocumentBlock[]> {
    const [logo, activities] = await Promise.all([
      this.header(LessonHeaderImage.MEDITATION_LEFT),
      this.meditationActivities(
        data,
        YOUNGER_MEDITATION_MAX_ACTIVITIES,
        loadImage,
      ),
    ]);
    return buildYoungerMeditationSheet({
      title: lessonString(data.title),
      verse: `“${unquoteLessonVerse(lessonString(data.verseText))}” (${normalizeLessonVerseReference(data.verseReference)})`,
      prayer: lessonString(data.prayer),
      logo,
      document: this.object(data.meditationDocument),
      activities,
    });
  }

  private async olderMeditationPage(
    data: Json,
    loadImage: LessonImageLoader,
  ): Promise<LessonDocumentBlock[]> {
    const [logo, activities] = await Promise.all([
      this.header(LessonHeaderImage.MEDITATION_LEFT),
      this.meditationActivities(
        data,
        OLDER_MEDITATION_MAX_ACTIVITIES,
        loadImage,
      ),
    ]);
    return buildOlderMeditationSheet({
      title: lessonString(data.title),
      verse: `“${unquoteLessonVerse(lessonString(data.verseText))}”\n${normalizeLessonVerseReference(data.verseReference)} — NVI`,
      biblicalText: lessonString(data.biblicalText),
      introduction: lessonString(data.introduction),
      prayer: lessonString(data.prayer),
      logo,
      document: this.object(data.meditationDocument),
      activities,
    });
  }

  private async manualWorkPage(
    data: Json,
    loadImage: LessonImageLoader,
  ): Promise<LessonDocumentBlock[]> {
    const [asset] = this.requiredAssets(
      Array.isArray(data.printableAssets)
        ? data.printableAssets.slice(0, 1)
        : [],
    );
    if (!asset)
      throw new UnprocessableEntityException(
        'O trabalho manual ainda não possui a arte para colorir. Gere o item novamente antes de exportar.',
      );
    const [image, logo] = await Promise.all([
      loadImage(String(asset.url)),
      this.header(LessonHeaderImage.LESSON_RIGHT),
    ]);
    return buildManualWorkSheet(
      image,
      logo,
      `“${unquoteLessonVerse(lessonString(data.verseText))}” (${lessonString(data.verseReference)} - NVI)`,
    );
  }

  /**
   * Per-document loader: each distinct URL is downloaded once, and downloads
   * run with bounded concurrency while pages are assembled in order.
   */
  private createImageLoader(): LessonImageLoader {
    const cache = new Map<string, Promise<Buffer>>();
    return (url: string): Promise<Buffer> => {
      const key = url.trim();
      let pending = cache.get(key);
      if (!pending) {
        pending = this.limitDownload(() => this.downloadImage(key));
        cache.set(key, pending);
      }
      return pending;
    };
  }

  private async downloadImage(url: string): Promise<Buffer> {
    const s3 = this.s3;
    return downloadSafeImageBuffer(url, {
      bucketName: this.config.get<string>('AWS_S3_BUCKET_NAME') ?? undefined,
      ...(s3
        ? {
            // Reads through the SDK: works with private buckets and skips DNS.
            s3ObjectReader: (_key: string, objectUrl: string) =>
              s3.downloadOwned(objectUrl, DEFAULT_MAX_IMAGE_ASSET_BYTES),
            onS3ReadFailure: (key: string, error: unknown) =>
              this.logger.warn(
                `Leitura direta do S3 falhou para ${key}; usando download HTTP. ${error instanceof Error ? error.message : String(error)}`,
              ),
          }
        : {}),
    });
  }
}
