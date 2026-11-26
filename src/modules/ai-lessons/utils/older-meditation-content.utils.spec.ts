import { editedOlderMeditation } from './older-meditation-content.utils';
import {
  meditationNodeText,
  meditationRichNodes,
} from './meditation-rich-text.utils';
import { meditationWordSearchIssue } from './meditation-word-search.utils';

describe('older saved meditation export', () => {
  it.each([true, false])(
    'repairs the saved edited puzzle and its renderable AST with marked fields=%s',
    (marked) => {
      const instruction =
        'Caça-palavras: encontre as palavras.\nABCDE\nFGHI\nJKLMN\nPalavras: JESUS, VIDA';
      const bold = {
        type: 'paragraph',
        attrs: { meditationField: 'firstActivity' },
        content: [
          { type: 'text', text: 'Questão editada.', marks: [{ type: 'bold' }] },
        ],
      };
      const document = {
        content: [
          bold,
          { type: 'heading', content: [{ type: 'text', text: 'INSTRUÇÃO' }] },
          {
            type: 'paragraph',
            attrs: marked ? { meditationField: 'thirdActivity' } : {},
            content: [{ type: 'text', text: instruction }],
          },
        ],
      };
      const content = editedOlderMeditation(
        {
          activities: [
            { number: 1, instruction: 'Primeira.' },
            { number: 2, instruction: 'Segunda.' },
            { number: 3, instruction: 'Antiga.' },
          ],
        },
        marked
          ? document
          : {
              content: [
                bold,
                ...[1, 2, 3].flatMap((number) => [
                  {
                    type: 'heading',
                    content: [{ type: 'text', text: 'INSTRUÇÃO' }],
                  },
                  {
                    type: 'paragraph',
                    content: [
                      {
                        type: 'text',
                        text: number === 3 ? instruction : `Questão ${number}.`,
                      },
                    ],
                  },
                ]),
              ],
            },
      );
      const rendered = meditationRichNodes(
        content.meditationDocument as Record<string, unknown>,
        'activity3',
      )
        .map(meditationNodeText)
        .join('\n');
      expect(meditationWordSearchIssue(rendered)).toBeNull();
      expect(rendered).not.toContain('FGHI\n');
      expect(rendered).toContain('Palavras: JESUS, VIDA');
      expect(
        meditationRichNodes(
          content.meditationDocument as Record<string, unknown>,
          'activity1',
        ),
      ).toContainEqual(bold);
      expect(meditationNodeText(document.content[2])).toBe(instruction);
    },
  );
});
