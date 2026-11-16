import * as JSZip from 'jszip';
import { IdeaTiptapDocxProvider } from './idea-tiptap-docx.provider';
import type { IdeaTiptapDocument, IdeaTiptapNode } from '../types';

const text = (
  value: string,
  marks: IdeaTiptapNode['marks'] = undefined,
): IdeaTiptapNode => ({
  type: 'text',
  text: value,
  ...(marks ? { marks } : {}),
});
const para = (...content: IdeaTiptapNode[]): IdeaTiptapNode => ({
  type: 'paragraph',
  content,
});

async function documentXml(doc: IdeaTiptapDocument): Promise<string> {
  const buffer = await new IdeaTiptapDocxProvider().toDocx(doc);
  const zip = await JSZip.loadAsync(buffer);
  return (await zip.file('word/document.xml')!.async('string')) ?? '';
}

describe('IdeaTiptapDocxProvider', () => {
  it('produces a valid docx with the text, headings, lists and a table', async () => {
    const xml = await documentXml({
      type: 'doc',
      content: [
        { type: 'heading', attrs: { level: 1 }, content: [text('Título')] },
        para(
          text('Negrito', [{ type: 'bold' }]),
          text(' e '),
          text('cor', [
            {
              type: 'textStyle',
              attrs: { color: '#ff0000', fontSize: '16px' },
            },
          ]),
        ),
        {
          type: 'orderedList',
          content: [
            { type: 'listItem', content: [para(text('Primeiro'))] },
            { type: 'listItem', content: [para(text('Segundo'))] },
          ],
        },
        {
          type: 'bulletList',
          content: [{ type: 'listItem', content: [para(text('Ponto'))] }],
        },
        {
          type: 'table',
          content: [
            {
              type: 'tableRow',
              content: [
                { type: 'tableHeader', content: [para(text('Nome'))] },
                { type: 'tableCell', content: [para(text('Ana'))] },
              ],
            },
          ],
        },
      ],
    });
    for (const expected of [
      'Título',
      'Negrito',
      'Primeiro',
      'Segundo',
      'Ponto',
      'Nome',
      'Ana',
    ])
      expect(xml).toContain(expected);
    expect(xml).toContain('1. ');
    expect(xml).toContain('<w:b/>');
    expect(xml).toContain('FF0000');
    expect(xml).toContain('<w:tbl>');
  });

  it('keeps only safe links and ignores unknown colors', async () => {
    const xml = await documentXml({
      type: 'doc',
      content: [
        para(
          text('seguro', [
            { type: 'link', attrs: { href: 'https://clubinho.org' } },
          ]),
          text('perigoso', [
            { type: 'link', attrs: { href: 'javascript:alert(1)' } },
          ]),
          text('cor', [{ type: 'textStyle', attrs: { color: 'red; x' } }]),
        ),
      ],
    });
    expect(xml).toContain('w:hyperlink');
    expect(xml).toContain('seguro');
    expect(xml).toContain('perigoso');
    expect(xml).not.toContain('javascript:');
    expect(xml).not.toContain('red; x');
  });

  it('renders an empty document without failing', async () => {
    const buffer = await new IdeaTiptapDocxProvider().toDocx({
      type: 'doc',
      content: [],
    });
    expect(buffer.subarray(0, 2).toString()).toBe('PK');
  });
});
