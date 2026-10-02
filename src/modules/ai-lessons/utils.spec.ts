import {
  buildGameInstructionImagePrompt,
  buildStoryVisualImagePrompt,
  buildVerseVisualImagePrompt,
  extractTiptapSectionText,
  lessonHeaderLines,
  lessonStoryHeading,
  normalizeLessonDocumentHeader,
} from './utils';

describe('AI lesson utilities', () => {
  it('separa cabeçalho salvo sem alterar o conteúdo editado e sem duplicar linhas', () => {
    const body = {
      type: 'paragraph',
      content: [{ type: 'text', text: 'Texto revisado.' }],
    };
    const original = {
      type: 'doc',
      content: [
        {
          type: 'heading',
          attrs: { level: 1 },
          content: [{ type: 'text', text: 'LIÇÃO 20 – O SEMEADOR' }],
        },
        body,
      ],
    };
    const normalized = normalizeLessonDocumentHeader(original, 20);
    expect(normalized.content).toEqual([
      ...['LIÇÃO 20', 'TÍTULO', 'O SEMEADOR'].map((text) => ({
        type: 'heading',
        attrs: { level: 1 },
        content: [{ type: 'text', text }],
      })),
      body,
    ]);
    expect(normalizeLessonDocumentHeader(normalized, 20)).toEqual(normalized);
    expect(original.content).toHaveLength(2);
  });
  it.each([
    'LIÇÃO 20 – O SEMEADOR',
    'LIÇÃO 20: O SEMEADOR',
    'O SEMEADOR',
    'LIÇÃO: O SEMEADOR',
  ])('separa o cabeçalho %s conforme o modelo manual', (title) => {
    expect(lessonHeaderLines(title, 20)).toEqual([
      'LIÇÃO 20',
      'TÍTULO',
      'O SEMEADOR',
    ]);
  });
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
    expect(prompt).toContain('no máximo 3 cores em toda a imagem');
    expect(prompt).toContain('mesma paleta de 3 cores em todos os cartões');
    expect(prompt).toContain('sem alternar uma cor diferente para cada letra');
  });
});

describe('sub-histórias da lição', () => {
  it('reconhece somente subtítulos explícitos e preserva o marcador ao extrair a história editada', () => {
    expect(lessonStoryHeading('### A Primeira Multiplicação')).toBe(
      'A Primeira Multiplicação',
    );
    expect(
      lessonStoryHeading('Jesus realizou a primeira multiplicação.'),
    ).toBeUndefined();
    const node = (text: string, level?: number) => ({
      type: level ? 'heading' : 'paragraph',
      attrs: level ? { level } : undefined,
      content: [{ type: 'text', text }],
    });
    expect(
      extractTiptapSectionText(
        {
          content: [
            node('LIÇÃO BÍBLICA', 2),
            node('Duas histórias.'),
            node('Primeira', 3),
            node('Cinco pães.'),
            node('Segunda', 3),
            node('Sete pães.'),
            node('APLICAÇÃO E APELO', 2),
            node('Outra seção.'),
          ],
        },
        'LIÇÃO BÍBLICA',
      ),
    ).toBe(
      'Duas histórias.\n\n### Primeira\n\nCinco pães.\n\n### Segunda\n\nSete pães.',
    );
  });
});
