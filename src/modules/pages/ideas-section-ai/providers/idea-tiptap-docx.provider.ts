import { Injectable } from '@nestjs/common';
import {
  AlignmentType,
  BorderStyle,
  Document,
  ExternalHyperlink,
  HeadingLevel,
  Packer,
  Paragraph,
  ParagraphChild,
  ShadingType,
  Table,
  TableCell,
  TableRow,
  TextRun,
  WidthType,
} from 'docx';
import {
  IdeaTiptapMarkType,
  IdeaTiptapNodeType,
} from '../enums/idea-tiptap.enums';
import type { IdeaTiptapDocument, IdeaTiptapNode } from '../types';

type Block = Paragraph | Table;

interface RunStyle {
  bold?: boolean;
  italics?: boolean;
  underline?: Record<string, never>;
  strike?: boolean;
  subScript?: boolean;
  superScript?: boolean;
  font?: string;
  size?: number;
  color?: string;
  shading?: { type: typeof ShadingType.CLEAR; fill: string };
}

interface BlockContext {
  /** Nível de aninhamento de listas e citações (recuo). */
  depth: number;
  italics?: boolean;
  monospace?: boolean;
}

const MONOSPACE = 'Courier New';
const INDENT = 360;
const TABLE_WIDTH = 9000;
const HEX_COLOR = /^#?([0-9a-f]{6}|[0-9a-f]{3})$/i;
const SAFE_LINK = /^(https?:\/\/|mailto:)/i;
const SAFE_FONT = /[^A-Za-z0-9 -]/g;
const ALIGNMENTS: Record<
  string,
  (typeof AlignmentType)[keyof typeof AlignmentType]
> = {
  left: AlignmentType.LEFT,
  center: AlignmentType.CENTER,
  right: AlignmentType.RIGHT,
  justify: AlignmentType.JUSTIFIED,
};
const HEADINGS: Record<
  number,
  (typeof HeadingLevel)[keyof typeof HeadingLevel]
> = {
  1: HeadingLevel.TITLE,
  2: HeadingLevel.HEADING_1,
  3: HeadingLevel.HEADING_2,
  4: HeadingLevel.HEADING_3,
};

const asString = (value: unknown): string | undefined =>
  typeof value === 'string' ? value : undefined;

function hex(value: unknown): string | undefined {
  const raw = asString(value)?.trim();
  if (!raw || !HEX_COLOR.test(raw)) return undefined;
  const digits = raw.replace('#', '');
  return (
    digits.length === 3
      ? digits
          .split('')
          .map((c) => c + c)
          .join('')
      : digits
  ).toUpperCase();
}

/** Tamanho do editor ("14px", "12pt", "14") em meios-pontos do Word. */
function halfPoints(value: unknown): number | undefined {
  const match = /^(\d+(?:\.\d+)?)\s*(px|pt)?$/i.exec(
    asString(value)?.trim() ?? '',
  );
  if (!match) return undefined;
  const points =
    match[2]?.toLowerCase() === 'pt'
      ? Number(match[1])
      : Number(match[1]) * 0.75;
  return Math.round(Math.min(96, Math.max(6, points)) * 2);
}

function fontFamily(value: unknown): string | undefined {
  const first = asString(value)?.split(',')[0]?.replace(SAFE_FONT, '').trim();
  return first ? first.slice(0, 60) : undefined;
}

/** Estilo de um trecho de texto a partir das marcas do editor. */
function runStyle(node: IdeaTiptapNode, context: BlockContext): RunStyle {
  const style: RunStyle = {};
  if (context.italics) style.italics = true;
  if (context.monospace) style.font = MONOSPACE;
  for (const mark of node.marks ?? []) {
    switch (mark.type as IdeaTiptapMarkType) {
      case IdeaTiptapMarkType.BOLD:
        style.bold = true;
        break;
      case IdeaTiptapMarkType.ITALIC:
        style.italics = true;
        break;
      case IdeaTiptapMarkType.UNDERLINE:
        style.underline = {};
        break;
      case IdeaTiptapMarkType.STRIKE:
        style.strike = true;
        break;
      case IdeaTiptapMarkType.CODE:
        style.font = MONOSPACE;
        break;
      case IdeaTiptapMarkType.SUBSCRIPT:
        style.subScript = true;
        break;
      case IdeaTiptapMarkType.SUPERSCRIPT:
        style.superScript = true;
        break;
      case IdeaTiptapMarkType.HIGHLIGHT: {
        const fill = hex(mark.attrs?.color) ?? 'FFFF00';
        style.shading = { type: ShadingType.CLEAR, fill };
        break;
      }
      case IdeaTiptapMarkType.TEXT_STYLE:
        style.color = hex(mark.attrs?.color) ?? style.color;
        style.size = halfPoints(mark.attrs?.fontSize) ?? style.size;
        style.font = fontFamily(mark.attrs?.fontFamily) ?? style.font;
        break;
      default:
        break;
    }
  }
  return style;
}

function inline(node: IdeaTiptapNode, context: BlockContext): ParagraphChild[] {
  const kind = node.type as IdeaTiptapNodeType;
  if (kind === IdeaTiptapNodeType.HARD_BREAK)
    return [new TextRun({ break: 1 })];
  if (kind !== IdeaTiptapNodeType.TEXT || !node.text) return [];
  const run = new TextRun({ text: node.text, ...runStyle(node, context) });
  const link = node.marks?.find(
    (mark) => (mark.type as IdeaTiptapMarkType) === IdeaTiptapMarkType.LINK,
  );
  const href = asString(link?.attrs?.href)?.trim();
  if (href && SAFE_LINK.test(href))
    return [
      new ExternalHyperlink({
        link: href,
        children: [
          new TextRun({
            text: node.text,
            ...runStyle(node, context),
            underline: {},
            color: '0563C1',
          }),
        ],
      }),
    ];
  return [run];
}

function inlineChildren(
  node: IdeaTiptapNode,
  context: BlockContext,
): ParagraphChild[] {
  return (node.content ?? []).flatMap((child) => inline(child, context));
}

/**
 * Converte o JSON do editor das ideias em DOCX. O conversor é só do módulo de
 * ideias: não compartilha código com a exportação do Estúdio, então uma
 * mudança lá não altera o PDF das ideias (e vice-versa).
 */
@Injectable()
export class IdeaTiptapDocxProvider {
  async toDocx(document: IdeaTiptapDocument): Promise<Buffer> {
    const children = document.content.flatMap((node) =>
      this.block(node, { depth: 0 }),
    );
    return Packer.toBuffer(
      new Document({
        sections: [
          { children: children.length ? children : [new Paragraph({})] },
        ],
      }),
    );
  }

  private block(node: IdeaTiptapNode, context: BlockContext): Block[] {
    switch (node.type as IdeaTiptapNodeType) {
      case IdeaTiptapNodeType.PARAGRAPH:
        return [this.paragraph(node, context)];
      case IdeaTiptapNodeType.HEADING: {
        const level = Number(node.attrs?.level) || 2;
        return [
          new Paragraph({
            heading: HEADINGS[level] ?? HeadingLevel.HEADING_4,
            alignment: ALIGNMENTS[asString(node.attrs?.textAlign) ?? ''],
            children: inlineChildren(node, context),
          }),
        ];
      }
      case IdeaTiptapNodeType.BULLET_LIST:
      case IdeaTiptapNodeType.ORDERED_LIST:
        return this.list(node, context);
      case IdeaTiptapNodeType.BLOCKQUOTE:
        return (node.content ?? []).flatMap((child) =>
          this.block(child, {
            ...context,
            depth: context.depth + 1,
            italics: true,
          }),
        );
      case IdeaTiptapNodeType.CODE_BLOCK:
        return [this.paragraph(node, { ...context, monospace: true })];
      case IdeaTiptapNodeType.HORIZONTAL_RULE:
        return [
          new Paragraph({
            border: {
              bottom: {
                style: BorderStyle.SINGLE,
                size: 6,
                color: '999999',
                space: 1,
              },
            },
          }),
        ];
      case IdeaTiptapNodeType.TABLE:
        return [this.table(node, context)];
      default:
        return [];
    }
  }

  private paragraph(
    node: IdeaTiptapNode,
    context: BlockContext,
    extra: { bullet?: boolean; prefix?: string } = {},
  ): Paragraph {
    const children = inlineChildren(node, context);
    if (extra.prefix) children.unshift(new TextRun({ text: extra.prefix }));
    return new Paragraph({
      alignment: ALIGNMENTS[asString(node.attrs?.textAlign) ?? ''],
      spacing: { after: 160 },
      ...(extra.bullet
        ? { bullet: { level: Math.min(context.depth, 8) } }
        : {}),
      ...(!extra.bullet && context.depth > 0
        ? { indent: { left: INDENT * (context.depth + 1) } }
        : {}),
      children,
    });
  }

  private list(node: IdeaTiptapNode, context: BlockContext): Block[] {
    const ordered =
      (node.type as IdeaTiptapNodeType) === IdeaTiptapNodeType.ORDERED_LIST;
    const start = Number(node.attrs?.start) || 1;
    return (node.content ?? []).flatMap((item, index) =>
      (item.content ?? []).flatMap((child, childIndex): Block[] => {
        if (
          (child.type as IdeaTiptapNodeType) === IdeaTiptapNodeType.PARAGRAPH &&
          childIndex === 0
        )
          return [
            ordered
              ? this.paragraph(
                  child,
                  { ...context, depth: context.depth + 1 },
                  { prefix: `${start + index}. ` },
                )
              : this.paragraph(child, context, { bullet: true }),
          ];
        return this.block(child, { ...context, depth: context.depth + 1 });
      }),
    );
  }

  private table(node: IdeaTiptapNode, context: BlockContext): Table {
    const rows = node.content ?? [];
    const columns = Math.max(
      1,
      ...rows.map((row) =>
        (row.content ?? []).reduce(
          (sum, cell) => sum + (Number(cell.attrs?.colspan) || 1),
          0,
        ),
      ),
    );
    const width = Math.floor(TABLE_WIDTH / columns);
    return new Table({
      width: { size: TABLE_WIDTH, type: WidthType.DXA },
      columnWidths: Array.from({ length: columns }, () => width),
      rows: rows.map(
        (row) =>
          new TableRow({
            children: (row.content ?? []).map((cell) => {
              const span = Math.min(columns, Number(cell.attrs?.colspan) || 1);
              const header =
                (cell.type as IdeaTiptapNodeType) ===
                IdeaTiptapNodeType.TABLE_HEADER;
              const blocks = (cell.content ?? []).flatMap((child) =>
                this.block(child, header ? { ...context } : context),
              );
              return new TableCell({
                columnSpan: span,
                width: { size: width * span, type: WidthType.DXA },
                shading: header
                  ? { type: ShadingType.CLEAR, fill: 'EEEEEE' }
                  : undefined,
                children: blocks.length ? blocks : [new Paragraph({})],
              });
            }),
          }),
      ),
    });
  }
}
