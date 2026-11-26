import { lessonInlineTextNodes } from './lesson-inline-text.utils';

describe('lessonInlineTextNodes', () => {
  it('converte **rótulo** em negrito e mantém o resto da linha', () => {
    expect(
      lessonInlineTextNodes('**Para quem já crê em Jesus:** confie nEle.'),
    ).toEqual([
      {
        type: 'text',
        text: 'Para quem já crê em Jesus:',
        marks: [{ type: 'bold' }],
      },
      { type: 'text', text: ' confie nEle.' },
    ]);
  });

  it('remove marcadores soltos sem criar negrito', () => {
    expect(lessonInlineTextNodes('Texto ** quebrado')).toEqual([
      { type: 'text', text: 'Texto  quebrado' },
    ]);
  });

  it('não altera texto sem Markdown', () => {
    expect(lessonInlineTextNodes('Jesus é poderoso.')).toEqual([
      { type: 'text', text: 'Jesus é poderoso.' },
    ]);
  });
});
