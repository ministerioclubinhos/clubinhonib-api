import { buildStoryVisualImagePrompt, extractTiptapSectionText } from './utils';

describe('AI lesson utilities', () => {
  it('extracts the complete edited biblical lesson section from Tiptap', () => {
    const story = extractTiptapSectionText(
      {
        type: 'doc',
        content: [
          {
            type: 'heading',
            attrs: { level: 2 },
            content: [{ type: 'text', text: 'LIÇÃO BÍBLICA' }],
          },
          {
            type: 'paragraph',
            content: [{ type: 'text', text: 'Primeiro trecho da história.' }],
          },
          {
            type: 'blockquote',
            content: [
              {
                type: 'paragraph',
                content: [{ type: 'text', text: 'Descrição da cena.' }],
              },
            ],
          },
          {
            type: 'heading',
            attrs: { level: 2 },
            content: [{ type: 'text', text: 'APLICAÇÃO E APELO' }],
          },
          {
            type: 'paragraph',
            content: [{ type: 'text', text: 'Não pertence à história.' }],
          },
        ],
      },
      'LIÇÃO BÍBLICA',
    );

    expect(story).toBe('Primeiro trecho da história.\n\nDescrição da cena.');
  });

  it('includes the complete story and canonical scene in every image prompt', () => {
    const prompt = buildStoryVisualImagePrompt({
      completeStory: 'Texto integral da lição bíblica.',
      canonicalScene: {
        id: 'scene-01',
        purpose: 'Jesus conversa com a criança.',
      },
      proposedComposition: 'Composição em plano aberto.',
    });

    expect(prompt).toContain('Texto integral da lição bíblica.');
    expect(prompt).toContain('scene-01');
    expect(prompt).toContain('Jesus conversa com a criança.');
    expect(prompt.toLocaleLowerCase('pt-BR')).toContain('fonte canônica');
    expect(prompt).toContain('Não invente');
  });
});
