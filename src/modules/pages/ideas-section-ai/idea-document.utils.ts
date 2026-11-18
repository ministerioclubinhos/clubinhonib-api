import { IDEA_DOCUMENT_EDITOR } from './constants';
import {
  IdeaDocumentBlockType,
  type EnhancedIdeaDocumentDto,
} from './dto/enhanced-idea.dto';
import { IdeaTiptapNodeType } from './enums/idea-tiptap.enums';
import type { IdeaTiptapDocument, IdeaTiptapNode } from './types';

const text = (value: string): IdeaTiptapNode => ({
  type: IdeaTiptapNodeType.TEXT,
  text: value,
});
const paragraph = (value: string, italic = false): IdeaTiptapNode => ({
  type: IdeaTiptapNodeType.PARAGRAPH,
  content: value
    ? [italic ? { ...text(value), marks: [{ type: 'italic' }] } : text(value)]
    : [],
});
const heading = (level: number, value: string): IdeaTiptapNode => ({
  type: IdeaTiptapNodeType.HEADING,
  attrs: { level },
  content: [text(value)],
});
const listItem = (value: string): IdeaTiptapNode => ({
  type: IdeaTiptapNodeType.LIST_ITEM,
  content: [paragraph(value)],
});

/**
 * Documento melhorado pela IA no formato do editor. É a mesma estrutura que
 * gera o DOCX e o PDF, então o que o editor mostra é o que o PDF contém.
 * Título é nível 1, seções nível 2 e a linha institucional nível 3.
 */
export function ideaDocumentToTiptap(
  document: EnhancedIdeaDocumentDto,
): IdeaTiptapDocument {
  const content: IdeaTiptapNode[] = [
    heading(3, IDEA_DOCUMENT_EDITOR.brandLine),
    heading(1, document.title),
  ];
  for (const section of document.sections) {
    if (section.heading) content.push(heading(2, section.heading));
    for (const block of section.blocks) {
      if (block.text)
        content.push(
          paragraph(block.text, block.type === IdeaDocumentBlockType.VERSE),
        );
      if (!block.items.length) continue;
      content.push({
        type:
          block.type === IdeaDocumentBlockType.NUMBERED_LIST
            ? IdeaTiptapNodeType.ORDERED_LIST
            : IdeaTiptapNodeType.BULLET_LIST,
        content: block.items.map(listItem),
      });
    }
  }
  return { type: 'doc', content };
}

/**
 * Documento a partir de texto simples, para resultados antigos que não
 * guardaram o conteúdo do editor: cada linha vira um parágrafo.
 */
export function ideaTextToTiptap(value: string): IdeaTiptapDocument {
  const lines = value
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  return {
    type: 'doc',
    content: lines.length
      ? lines.map((line) => paragraph(line))
      : [paragraph('')],
  };
}

/** Texto corrido do documento, na ordem de leitura. */
export function tiptapPlainText(node: IdeaTiptapNode): string {
  const kind = node.type as IdeaTiptapNodeType;
  if (kind === IdeaTiptapNodeType.TEXT) return node.text ?? '';
  if (kind === IdeaTiptapNodeType.HARD_BREAK) return '\n';
  const parts = (node.content ?? []).map(tiptapPlainText);
  const endsLine =
    kind === IdeaTiptapNodeType.PARAGRAPH ||
    kind === IdeaTiptapNodeType.HEADING ||
    kind === IdeaTiptapNodeType.LIST_ITEM ||
    kind === IdeaTiptapNodeType.TABLE_ROW;
  return (
    parts.join(kind === IdeaTiptapNodeType.TABLE_ROW ? '\t' : '') +
    (endsLine ? '\n' : '')
  );
}

const KNOWN_NODES = new Set<string>(Object.values(IdeaTiptapNodeType));

/**
 * Confere um documento recebido do editor antes de renderizar: formato,
 * profundidade, quantidade de nós, tipos conhecidos, tamanho e conteúdo.
 * Devolve a mensagem do primeiro problema, ou `null` quando está tudo certo.
 */
export function validateIdeaTiptapDocument(input: unknown): string | null {
  if (!input || typeof input !== 'object' || Array.isArray(input))
    return 'O documento deve ser um objeto.';
  const root = input as Partial<IdeaTiptapDocument>;
  if (
    (root.type as string) !== (IdeaTiptapNodeType.DOC as string) ||
    !Array.isArray(root.content)
  )
    return 'O documento deve começar em "doc" com uma lista de conteúdo.';
  if (JSON.stringify(input).length > IDEA_DOCUMENT_EDITOR.maxSerializedBytes)
    return 'O documento é grande demais.';

  let nodes = 0;
  const visit = (node: unknown, depth: number): string | null => {
    if (depth > IDEA_DOCUMENT_EDITOR.maxDepth)
      return 'O documento tem aninhamento demais.';
    if (!node || typeof node !== 'object' || Array.isArray(node))
      return 'Há um item inválido no documento.';
    const current = node as IdeaTiptapNode;
    if (typeof current.type !== 'string' || !KNOWN_NODES.has(current.type))
      return `Elemento não suportado no documento: ${String(current.type)}.`;
    if (++nodes > IDEA_DOCUMENT_EDITOR.maxNodes)
      return 'O documento tem elementos demais.';
    if (current.content !== undefined) {
      if (!Array.isArray(current.content))
        return 'Há um conteúdo inválido no documento.';
      for (const child of current.content) {
        const problem = visit(child, depth + 1);
        if (problem) return problem;
      }
    }
    if (current.text !== undefined && typeof current.text !== 'string')
      return 'Há um texto inválido no documento.';
    return null;
  };
  for (const child of root.content) {
    const problem = visit(child, 1);
    if (problem) return problem;
  }

  const plain = tiptapPlainText(root as IdeaTiptapNode).trim();
  if (!plain) return 'O documento não pode ficar vazio.';
  if (plain.length > IDEA_DOCUMENT_EDITOR.maxCharacters)
    return 'O documento tem texto demais.';
  return null;
}
