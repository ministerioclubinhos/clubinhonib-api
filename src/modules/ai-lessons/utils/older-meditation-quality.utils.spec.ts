import {
  olderMeditationContentIssue,
  olderMeditationExpansionContext,
  olderMeditationLessonSource,
} from './older-meditation-quality.utils';

describe('older meditation content density', () => {
  it('uses lesson narrative, verse and application without sending images or unrelated fields', () => {
    const source = olderMeditationLessonSource({
      title: 'Jesus vive',
      story: 'Relato aprovado.',
      memoryVerse: { text: 'Jesus vive.' },
      applicationAndAppeal: 'Confie em Jesus.',
      visualScenes: [{ prompt: 'Arte extensa.' }],
      printableAssets: [{ url: 'image-url' }],
    });
    expect(source).toMatchObject({
      story: 'Relato aprovado.',
      memoryVerse: { text: 'Jesus vive.' },
      applicationAndAppeal: 'Confie em Jesus.',
    });
    expect(source).not.toHaveProperty('visualScenes');
    expect(source).not.toHaveProperty('printableAssets');
    expect(olderMeditationLessonSource(null)).toBeNull();
  });
  it('counts only child instructions and supplies the previous content for targeted correction', () => {
    const content = {
      introduction: 'Introdução longa não conta.',
      activities: [
        {
          instruction: 'Leia e responda.',
          answer: 'Gabarito também não conta.',
        },
        { instruction: 'Complete as frases.' },
        { instruction: 'Marque a alternativa.' },
      ],
    };
    expect(olderMeditationExpansionContext(content)).toContain('9 palavras');
    expect(olderMeditationExpansionContext(content)).toContain('3, 3, 3');
    expect(olderMeditationExpansionContext(content)).toContain(
      JSON.stringify(content),
    );
    expect(olderMeditationContentIssue(content)).toContain(
      '9 palavras; mínimo 200',
    );
  });
  it('rejects the sparse three-question worksheet before generating images', () => {
    expect(
      olderMeditationContentIssue({
        activities: [
          { instruction: 'Complete a frase: Jesus é a vida.' },
          { instruction: 'Certo ou errado? Jesus chorou.' },
          { instruction: 'Descubra a mensagem pelas iniciais.' },
        ],
      }),
    ).toContain('pouco conteúdo');
  });
  it('accepts substantial blocks of questions and clues', () => {
    expect(
      olderMeditationContentIssue({
        activities: Array.from({ length: 3 }, () => ({
          instruction:
            'Jesus mostrou seu poder e sua compaixão pelos seus amigos. '.repeat(
              8,
            ),
        })),
      }),
    ).toBeNull();
  });
  it('rejects missing blocks or instructions', () => {
    expect(olderMeditationContentIssue({ activities: [] })).toContain(
      'três blocos',
    );
    expect(
      olderMeditationContentIssue({
        activities: [{ instruction: '' }, {}, {}],
      }),
    ).toContain('sem instrução');
  });
  it('rejects malformed puzzles even when instructions meet the word count', () => {
    expect(
      olderMeditationContentIssue({
        activities: [
          {
            instruction:
              'Caça-palavras\nPIXVIÚVAJ\nQÁZARONES\nRESSUREIÇÃO\nPalavras: VIÚVA, JESUS\n' +
              'Confira os fatos da lição. '.repeat(50),
          },
          { instruction: 'Marque as respostas.' },
          { instruction: 'Complete as frases.' },
        ],
      }),
    ).toContain('tamanhos diferentes');
  });
});
