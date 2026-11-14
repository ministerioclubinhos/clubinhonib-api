import {
  buildGameSummaryImagePrompt,
  buildStoryVisualImagePrompt,
  buildVerseVisualImagePrompt,
  extractTiptapSectionText,
  lessonHeaderLines,
  lessonStoryHeading,
  normalizeLessonVerseReference,
  normalizeLessonDocumentHeader,
} from './utils';
import { isBibleReference } from './utils/lesson-canonical-content.utils';

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

  it('puts the exact verse in a highlighted band of the fixation compiled image', () => {
    const prompt = buildGameSummaryImagePrompt({
      game: {
        name: 'Corrida do Versículo',
        verseText: 'Se não ouvem a Moisés e aos Profetas, não acreditarão',
        verseReference: 'Lucas 16:31a',
        steps: [
          'Formem equipes.',
          'Corram e montem o versículo.',
          'Recitem juntos.',
        ],
      },
      proposedComposition: 'Infográfico vertical.',
    });

    expect(prompt).toContain('BRINCADEIRA DE FIXAÇÃO DESTE VERSÍCULO');
    expect(prompt).toContain(
      '"Se não ouvem a Moisés e aos Profetas, não acreditarão"',
    );
    expect(prompt).toContain('"Lucas 16:31a"');
    expect(prompt).toContain('exatamente 3 paradas numeradas');
    expect(prompt).toContain('título "Corrida do Versículo"');
  });

  it('keeps the fun game compiled image free of a verse band', () => {
    const prompt = buildGameSummaryImagePrompt({
      game: { name: 'Pescaria', steps: ['Pesquem.'] },
      proposedComposition: 'Infográfico vertical.',
    });
    expect(prompt).not.toContain('FIXAÇÃO DESTE VERSÍCULO');
  });

  it('requests the final verse text inside the generated image', () => {
    const prompt = buildVerseVisualImagePrompt({
      fullVerse: 'Eu sou a ressurreição e a vida.',
      verseReference: 'João 11:25',
      displayText: 'Eu sou a ressurreição e a vida.',
      proposedComposition: 'Cores suaves e alegres.',
    });

    expect(prompt).toContain('PROPORÇÃO 90/10');
    expect(prompt).toContain('ocupa cerca de 90% da imagem');
    expect(prompt).toContain('remetem ao sentido DESTE trecho');
    expect(prompt).toContain('desenhos MINÚSCULOS');
    expect(prompt).toContain('A quantidade NÃO é fixa');
    expect(prompt).not.toMatch(/de \d+ a \d+ (pequenos )?desenhos/);
    expect(prompt).toContain('NUNCA diminua o texto');
    expect(prompt).toContain('PRIMEIRO o texto');
    expect(prompt).toContain('sem repetir o mesmo ícone');
    expect(prompt).toContain('SEM BORDA BRANCA');
    expect(prompt).toContain('nunca contorno branco');
    expect(prompt).toContain('não devem ser azul com nuvens por padrão');
    expect(prompt).not.toContain('nuvens estilizadas');
    expect(prompt).not.toContain('95%');
    expect(prompt).toContain('pessoas, personagens');
    expect(prompt).toContain('DEVE APARECER DENTRO DA IMAGEM');
    expect(prompt).toContain('VERSÍCULO COMPLETO NVI');
    expect(prompt).toContain('João 11:25');
    expect(prompt).toContain('no máximo 3 cores em toda a imagem');
    expect(prompt).toContain('mesma paleta de 3 cores em todos os cartões');
    expect(prompt).toContain('sem uma cor diferente para cada letra');
  });
});

describe('cartão do versículo sem pontuação vizinha', () => {
  it('fixa o primeiro e o último caractere e ignora texto citado na composição', () => {
    const prompt = buildVerseVisualImagePrompt({
      fullVerse: 'Se não ouvem a Moisés e aos Profetas, não acreditarão',
      verseReference: 'Lucas 16:31a',
      displayText: 'não acreditarão',
      proposedComposition:
        'Texto exato “, não acreditarão”, incluindo a vírgula inicial.',
    });
    expect(prompt).toContain('O texto começa com "n" e termina com "o"');
    expect(prompt).toContain('Não acrescente vírgula, ponto');
    expect(prompt).toContain('vale somente o TEXTO OBRIGATÓRIO');
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

describe('referência do versículo', () => {
  it.each([
    'João 6:35 NVI',
    'João 6:35 — NVI',
    'João 6:35 (NVI)',
    'João 6:35 NVI — NVI',
  ])('remove a versão redundante de %s', (reference) => {
    expect(normalizeLessonVerseReference(reference)).toBe('João 6:35');
  });
  it.each([
    ['João 6:35 (trecho) — NVI', 'João 6:35'],
    ['1 João 3:8b (trecho)', '1 João 3:8b'],
    ['1 João 3:8b — trecho', '1 João 3:8b'],
    ['Trecho de Hebreus 9:22', 'Hebreus 9:22'],
  ])(
    'retira o qualificador de trecho de %s: a letra do versículo já indica a seleção parcial',
    (reference, expected) => {
      expect(normalizeLessonVerseReference(reference)).toBe(expected);
      expect(isBibleReference(normalizeLessonVerseReference(reference))).toBe(
        true,
      );
    },
  );
  it('não altera referências sem versão nem qualificador', () => {
    expect(normalizeLessonVerseReference('Hebreus 9:22b')).toBe(
      'Hebreus 9:22b',
    );
  });
});
