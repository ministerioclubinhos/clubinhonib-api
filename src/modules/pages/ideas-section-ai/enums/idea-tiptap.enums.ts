/** Nós que o editor de documentos das ideias sabe criar e o conversor sabe ler. */
export enum IdeaTiptapNodeType {
  DOC = 'doc',
  PARAGRAPH = 'paragraph',
  HEADING = 'heading',
  TEXT = 'text',
  BULLET_LIST = 'bulletList',
  ORDERED_LIST = 'orderedList',
  LIST_ITEM = 'listItem',
  BLOCKQUOTE = 'blockquote',
  HORIZONTAL_RULE = 'horizontalRule',
  HARD_BREAK = 'hardBreak',
  CODE_BLOCK = 'codeBlock',
  TABLE = 'table',
  TABLE_ROW = 'tableRow',
  TABLE_CELL = 'tableCell',
  TABLE_HEADER = 'tableHeader',
}

/** Marcas de texto aceitas no documento. */
export enum IdeaTiptapMarkType {
  BOLD = 'bold',
  ITALIC = 'italic',
  UNDERLINE = 'underline',
  STRIKE = 'strike',
  CODE = 'code',
  SUBSCRIPT = 'subscript',
  SUPERSCRIPT = 'superscript',
  HIGHLIGHT = 'highlight',
  LINK = 'link',
  TEXT_STYLE = 'textStyle',
}
