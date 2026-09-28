import {
  buildGameInstructionImagePrompt,
  buildStoryVisualImagePrompt,
  buildVerseVisualImagePrompt,
  extractTiptapSectionText,
} from './utils';

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
      hasIdentityReference: true,
    });

    expect(prompt).toContain('Texto integral da lição bíblica.');
    expect(prompt).toContain('scene-01');
    expect(prompt).toContain('Jesus conversa com a criança.');
    expect(prompt.toLocaleLowerCase('pt-BR')).toContain('fonte canônica');
    expect(prompt).toContain('Não invente');
    expect(prompt).toContain('imagem de referência anexada');
  });

  it('includes the complete game and exact step in an instructional image prompt', () => {
    const prompt = buildGameInstructionImagePrompt({
      game: {
        name: 'Caminho da bondade',
        objective: 'Praticar atitudes de bondade.',
        materials: ['cones', 'cartões'],
        preparation: ['Organize os cones em linha.'],
        steps: ['Forme duas filas.', 'Cada criança contorna um cone.'],
        rulesAndSafety: ['Não correr.'],
      },
      stepNumber: 2,
      instruction: 'Cada criança contorna um cone.',
      proposedComposition: 'Criança caminhando ao redor do cone.',
    });

    expect(prompt).toContain('Caminho da bondade');
    expect(prompt).toContain('Forme duas filas.');
    expect(prompt).toContain('INSTRUÇÃO 2');
    expect(prompt).toContain('Cada criança contorna um cone.');
    expect(prompt).toContain('demonstre claramente como executar');
    expect(prompt).toContain('Não produza uma ilustração decorativa genérica');
  });

  it('requests the final verse text inside the generated image', () => {
    const prompt = buildVerseVisualImagePrompt({
      fullVerse: 'Eu sou a ressurreição e a vida.',
      verseReference: 'João 11:25',
      displayText: 'Eu sou a ressurreição e a vida.',
      proposedComposition: 'Cores suaves e alegres.',
    });

    expect(prompt).toContain('95% da área central livre');
    expect(prompt).toContain('pessoas, personagens');
    expect(prompt).toContain('objetos reconhecíveis');
    expect(prompt).toContain('DEVE APARECER DENTRO DA IMAGEM');
    expect(prompt).toContain('95% da imagem');
    expect(prompt).toContain('VERSÍCULO COMPLETO NVI');
    expect(prompt).toContain('João 11:25');
  });
});
