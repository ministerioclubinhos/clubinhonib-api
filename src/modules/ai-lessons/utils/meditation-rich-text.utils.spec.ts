import { Document, Packer } from 'docx';
import * as JSZip from 'jszip';
import { meditationRichParagraphs } from './meditation-rich-text.utils';

describe('meditation rich text export', () => {
  it('exports saved font, emphasis, colors, alignment and lists', async () => {
    const document = {
      content: [
        { type: 'heading', content: [{ type: 'text', text: 'INSTRUÇÃO' }] },
        {
          type: 'paragraph',
          attrs: { textAlign: 'right' },
          content: [
            {
              type: 'text',
              text: 'Circule a resposta.',
              marks: [
                { type: 'bold' },
                { type: 'italic' },
                { type: 'underline' },
                {
                  type: 'textStyle',
                  attrs: {
                    color: '#ff0000',
                    fontSize: '12pt',
                    fontFamily: 'Verdana',
                  },
                },
                { type: 'highlight', attrs: { color: '#ffff00' } },
              ],
            },
          ],
        },
        {
          type: 'bulletList',
          content: [
            {
              type: 'listItem',
              content: [
                {
                  type: 'paragraph',
                  content: [{ type: 'text', text: 'Alternativa A' }],
                },
              ],
            },
          ],
        },
      ],
    };
    const paragraphs = meditationRichParagraphs(document, 'activity1', '', 20);
    const buffer = await Packer.toBuffer(
      new Document({ sections: [{ children: paragraphs }] }),
    );
    const zip = await JSZip.loadAsync(buffer);
    const xml = await zip.file('word/document.xml')!.async('string');
    for (const token of [
      'w:val="right"',
      'w:val="FF0000"',
      'w:val="24"',
      'Verdana',
      'w:b',
      'w:i',
      'w:u',
      'w:fill="FFFF00"',
      '• ',
      'Alternativa A',
    ])
      expect(xml).toContain(token);
  });
});
