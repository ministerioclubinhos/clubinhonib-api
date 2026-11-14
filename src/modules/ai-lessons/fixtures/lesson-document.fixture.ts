export const FORMATTED_LESSON_DOCUMENT = {
  type: 'doc',
  content: [
    {
      type: 'heading',
      attrs: { level: 1 },
      content: [{ type: 'text', text: 'LIÇÃO 20' }],
    },
    {
      type: 'heading',
      attrs: { level: 2 },
      content: [{ type: 'text', text: 'TÍTULO' }],
    },
    { type: 'paragraph', content: [{ type: 'text', text: 'O SEMEADOR' }] },
    {
      type: 'paragraph',
      attrs: { lineHeight: '2', textAlign: 'right' },
      content: [
        {
          type: 'text',
          text: 'Texto revisado com fonte maior.',
          marks: [
            {
              type: 'textStyle',
              attrs: {
                fontFamily: 'Arial',
                fontSize: '24pt',
                color: '#C53030',
              },
            },
            { type: 'bold' },
            { type: 'italic' },
            { type: 'highlight', attrs: { color: '#FFF200' } },
          ],
        },
      ],
    },
    {
      type: 'paragraph',
      attrs: { lineHeight: '1.5' },
      content: [
        {
          type: 'text',
          text: 'Abrir material de apoio',
          marks: [
            {
              type: 'textStyle',
              attrs: { fontFamily: 'Times New Roman', fontSize: '16pt' },
            },
            { type: 'link', attrs: { href: 'https://example.com/apoio' } },
          ],
        },
      ],
    },
    { type: 'paragraph', content: [] },
    { type: 'horizontalRule' },
    {
      type: 'table',
      content: [
        {
          type: 'tableRow',
          content: [
            {
              type: 'tableCell',
              attrs: { colspan: 2, rowspan: 2, colwidth: [140, 160] },
              content: [
                {
                  type: 'heading',
                  attrs: { level: 2 },
                  content: [{ type: 'text', text: 'Célula mesclada' }],
                },
                {
                  type: 'paragraph',
                  content: [{ type: 'text', text: 'Conteúdo preservado' }],
                },
              ],
            },
            {
              type: 'tableCell',
              content: [
                {
                  type: 'paragraph',
                  content: [{ type: 'text', text: 'Coluna livre' }],
                },
              ],
            },
          ],
        },
        {
          type: 'tableRow',
          content: [
            {
              type: 'tableCell',
              content: [
                {
                  type: 'paragraph',
                  content: [{ type: 'text', text: 'Segunda linha' }],
                },
              ],
            },
          ],
        },
      ],
    },
  ],
};
