import { lessonNarrativeIssue } from './lessonNarrative.utils';

describe('generic narrative integrity', () => {
  it.each([
    '',
    'Jesus respondeu: "Se podes?',
    'Jesus respondeu: “Venha.',
    'A história continua:',
    '### Segundo relato',
  ])('detecta incompletude em %s', (story) => {
    expect(lessonNarrativeIssue(story)).not.toBeNull();
  });
  it.each([
    'Jesus disse: "Não tenha medo!" Todos ouviram seu ensino.',
    'Jesus disse: “Não tenha medo!” Todos ouviram seu ensino.',
    'Hoje aprenderemos dois relatos.\n### Primeiro relato\nAcontecimento e conclusão.\n### Segundo relato\nOutro acontecimento e conclusão.',
    'Quem está pronto para aprender?',
  ])(
    'preserva conteúdo completo sem regras dependentes do tema: %s',
    (story) => {
      expect(lessonNarrativeIssue(story)).toBeNull();
    },
  );
});
