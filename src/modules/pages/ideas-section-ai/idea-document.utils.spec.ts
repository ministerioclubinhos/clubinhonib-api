import 'reflect-metadata';
import { IdeaDocumentBlockType } from './dto/enhanced-idea.dto';
import type { EnhancedIdeaDocumentDto } from './dto/enhanced-idea.dto';
import {
  ideaDocumentToTiptap,
  ideaTextToTiptap,
  tiptapPlainText,
  validateIdeaTiptapDocument,
} from './idea-document.utils';
import type { IdeaTiptapDocument, IdeaTiptapNode } from './types';

const structured: EnhancedIdeaDocumentDto = {
  title: 'Gincana das bolas',
  sections: [
    {
      heading: 'Materiais',
      blocks: [
        {
          type: IdeaDocumentBlockType.PARAGRAPH,
          text: 'Separe 3 bolas.',
          items: [],
        },
        { type: IdeaDocumentBlockType.VERSE, text: 'João 3:16', items: [] },
        {
          type: IdeaDocumentBlockType.BULLET_LIST,
          text: '',
          items: ['Bolas', 'Cones'],
        },
        {
          type: IdeaDocumentBlockType.NUMBERED_LIST,
          text: '',
          items: ['Forme equipes'],
        },
      ],
    },
  ],
  hasEssentialVisuals: false,
  preservedFacts: [],
};

describe('documento das ideias no formato do editor', () => {
  it('converts the structured result keeping brand line, title, sections and lists', () => {
    const doc = ideaDocumentToTiptap(structured);
    expect(doc.type).toBe('doc');
    expect(doc.content.map((n) => n.type)).toEqual([
      'heading',
      'heading',
      'heading',
      'paragraph',
      'paragraph',
      'bulletList',
      'orderedList',
    ]);
    expect(doc.content[0].attrs?.level).toBe(3);
    expect(doc.content[1].attrs?.level).toBe(1);
    expect(tiptapPlainText(doc as IdeaTiptapNode)).toContain(
      'Gincana das bolas',
    );
    expect(doc.content[4].content?.[0].marks).toEqual([{ type: 'italic' }]);
    expect(validateIdeaTiptapDocument(doc)).toBeNull();
  });

  it('builds a document from plain text, one paragraph per non-empty line', () => {
    const doc = ideaTextToTiptap('Linha um\n\n  Linha dois  \r\nTrês');
    expect(doc.content).toHaveLength(3);
    expect(ideaTextToTiptap('   ').content).toHaveLength(1);
  });

  describe('validation', () => {
    const doc = (content: IdeaTiptapNode[]): IdeaTiptapDocument => ({
      type: 'doc',
      content,
    });
    const para = (value: string): IdeaTiptapNode => ({
      type: 'paragraph',
      content: [{ type: 'text', text: value }],
    });

    it('accepts a normal document', () => {
      expect(validateIdeaTiptapDocument(doc([para('Olá')]))).toBeNull();
    });
    it.each([
      [null, /objeto/],
      [[], /objeto/],
      [{ type: 'paragraph', content: [] }, /doc/],
      [{ type: 'doc' }, /doc/],
    ])('rejects a wrong shape (%j)', (input, message) => {
      expect(validateIdeaTiptapDocument(input)).toMatch(message);
    });
    it('rejects unknown elements such as embedded scripts or images', () => {
      expect(
        validateIdeaTiptapDocument(doc([{ type: 'script', text: 'x' }])),
      ).toMatch(/não suportado/);
      expect(
        validateIdeaTiptapDocument(
          doc([{ type: 'image', attrs: { src: 'x' } }]),
        ),
      ).toMatch(/não suportado/);
    });
    it('rejects an empty document', () => {
      expect(validateIdeaTiptapDocument(doc([para('   ')]))).toMatch(/vazio/);
      expect(validateIdeaTiptapDocument(doc([]))).toMatch(/vazio/);
    });
    it('rejects excessive nesting', () => {
      let node: IdeaTiptapNode = para('fundo');
      for (let i = 0; i < 60; i++)
        node = { type: 'blockquote', content: [node] };
      expect(validateIdeaTiptapDocument(doc([node]))).toMatch(/aninhamento/);
    });
    it('rejects invalid children and non-string text', () => {
      expect(
        validateIdeaTiptapDocument(
          doc([
            { type: 'paragraph', content: 'x' as unknown as IdeaTiptapNode[] },
          ]),
        ),
      ).toMatch(/conteúdo inválido/);
      expect(
        validateIdeaTiptapDocument(
          doc([
            {
              type: 'paragraph',
              content: [{ type: 'text', text: 5 as unknown as string }],
            },
          ]),
        ),
      ).toMatch(/texto inválido/);
    });
    it('rejects a document with too many characters', () => {
      expect(
        validateIdeaTiptapDocument(doc([para('a'.repeat(60_001))])),
      ).toMatch(/texto demais|grande demais/);
    });
  });
});
