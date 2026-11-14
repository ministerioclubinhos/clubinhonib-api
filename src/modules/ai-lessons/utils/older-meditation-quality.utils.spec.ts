import {
  olderMeditationReadingWords,
  olderMeditationContentIssue,
  olderMeditationInstructionWords,
  normalizeOlderMeditation,
} from './older-meditation-quality.utils';
import { olderMeditationFixture } from '../fixtures/older-meditation.fixture';
import type { MeditationJson } from '../types/younger-meditation.types';
import { OlderMeditationMechanic as M } from '../enums/older-meditation.enums';

function activities(content: MeditationJson): MeditationJson[] {
  return content.activities as MeditationJson[];
}

describe('older meditation executable content contract', () => {
  it.each(['O bom samaritano', 'A criação', 'Jesus acalma a tempestade'])(
    'does not prescribe topic words or a fixed activity template: %s',
    (theme) => {
      const content = normalizeOlderMeditation(olderMeditationFixture(theme));
      expect(olderMeditationContentIssue(content)).toBeNull();
      expect(content.title).toBe(theme);
    },
  );
  it.each([1, 2, 3])(
    'accepts %i complete textual subitems without padding to four',
    (count) => {
      const content = olderMeditationFixture();
      for (const activity of activities(content).slice(0, 2)) {
        activity.subitems = (activity.subitems as MeditationJson[]).slice(
          0,
          count,
        );
      }
      expect(
        olderMeditationContentIssue(normalizeOlderMeditation(content)),
      ).toBeNull();
    },
  );
  it.each([0, 7])(
    'rejects %i subitems outside the shared contract',
    (count) => {
      const content = olderMeditationFixture();
      const first = activities(content)[0];
      const item = (first.subitems as MeditationJson[])[0];
      first.subitems = Array.from({ length: count }, () => ({ ...item }));
      expect(
        olderMeditationContentIssue(normalizeOlderMeditation(content)),
      ).toContain('1–6 subitens');
    },
  );
  it.each([
    '',
    'Pense no que aprendeu.',
    'Recorde a história e observe as atitudes das pessoas.',
  ])('accepts short meaningful introductions: %s', (introduction) => {
    const content = olderMeditationFixture();
    content.introduction = introduction;
    expect(
      olderMeditationContentIssue(normalizeOlderMeditation(content)),
    ).toBeNull();
  });
  it.each(['palavra '.repeat(26)])(
    'rejects introductions over 25 words (the context belongs to each question)',
    (introduction) => {
      const content = olderMeditationFixture();
      content.introduction = introduction;
      expect(
        olderMeditationContentIssue(normalizeOlderMeditation(content)),
      ).toContain('introdução');
    },
  );
  it('prints short choices on one line without changing their order or answer', () => {
    const content = olderMeditationFixture();
    const activity = activities(content)[1];
    activity.mechanic = M.TRUE_FALSE;
    for (const item of activity.subitems as MeditationJson[]) {
      item.options = ['Verdadeiro', 'Falso'];
      item.answer = 'Verdadeiro';
    }
    const normalized = normalizeOlderMeditation(content);
    expect(activities(normalized)[1].instruction).toContain(
      '( ) Verdadeiro   ( ) Falso',
    );
    expect(olderMeditationContentIssue(normalized)).toBeNull();
    expect(
      (activities(normalized)[1].subitems as MeditationJson[])[0].answer,
    ).toBe('Verdadeiro');
  });
  it('requires evidence but leaves semantic grounding to the mandatory reviewer', () => {
    const content = olderMeditationFixture();
    activities(content)[0].sourceExcerpt =
      'O viajante recebeu cuidados de um samaritano.';
    expect(
      olderMeditationContentIssue(normalizeOlderMeditation(content)),
    ).toBeNull();
    // An empty internal excerpt is filled from the question's own context.
    activities(content)[0].sourceExcerpt = '  ';
    expect(
      olderMeditationContentIssue(normalizeOlderMeditation(content)),
    ).toBeNull();
    activities(content)[0].sourceExcerpt = '  ';
    activities(content)[0].context = '';
    expect(
      olderMeditationContentIssue(normalizeOlderMeditation(content)),
    ).not.toBeNull();
  });
  it('does not accept repetitive prose in place of exercises or an empty answer key', () => {
    const content = olderMeditationFixture();
    content.activities = [
      { instruction: 'Texto de preenchimento. '.repeat(100) },
      { instruction: 'Responda.' },
      { instruction: 'Responda.' },
    ];
    expect(
      olderMeditationContentIssue(normalizeOlderMeditation(content)),
    ).not.toBeNull();
    const valid = olderMeditationFixture();
    (activities(valid)[0].subitems as MeditationJson[])[0].answer = '';
    expect(
      olderMeditationContentIssue(normalizeOlderMeditation(valid)),
    ).toContain('gabarito');
  });
  it('accepts 2 to 4 questions and rejects sheets outside that range', () => {
    const base = activities(olderMeditationFixture());
    for (const count of [2, 3, 4]) {
      const content = olderMeditationFixture();
      content.activities =
        count === 4
          ? [
              ...base.slice(0, 2),
              { ...base[1], number: 3, mechanic: M.TRUE_FALSE },
              base[2],
            ].map((item, index) => ({
              ...item,
              subitems:
                index === 2
                  ? [
                      {
                        prompt: 'O samaritano levou o homem a uma hospedaria.',
                        options: ['Certo', 'Errado'],
                        answer: 'Certo',
                      },
                    ]
                  : item.subitems,
            }))
          : count === 2
            ? [base[0], base[2]]
            : base;
      expect(
        olderMeditationContentIssue(normalizeOlderMeditation(content)),
      ).toBeNull();
    }
    for (const count of [1, 5]) {
      const content = olderMeditationFixture();
      content.activities = Array.from(
        { length: count },
        (_, index) => base[index % 3],
      );
      expect(
        olderMeditationContentIssue(normalizeOlderMeditation(content)),
      ).toContain('2 a 4 questões');
    }
  });
  it('joins the story context and the command in the first paragraph of the question', () => {
    const content = normalizeOlderMeditation(olderMeditationFixture());
    expect(String(activities(content)[0].instruction).split('\n')[0]).toBe(
      'Recorde os acontecimentos da história. Complete usando o banco de palavras.',
    );
  });
  it('reconciles art with visualRequired locally and still rejects repeated questions', () => {
    const misplaced = olderMeditationFixture();
    (misplaced.printableAssets as MeditationJson[]).push({
      id: '2',
      prompt: 'Cena sem visualRequired.',
    });
    const reconciled = normalizeOlderMeditation(misplaced);
    // Planned art makes the question illustrated instead of failing the sheet.
    expect(activities(reconciled)[1].visualRequired).toBe(true);
    expect(olderMeditationContentIssue(reconciled)).toBeNull();
    const missing = olderMeditationFixture();
    missing.printableAssets = [];
    const textOnly = normalizeOlderMeditation(missing);
    // A question marked illustrated without any art becomes text-only.
    expect(
      activities(textOnly).every((item) => item.visualRequired === false),
    ).toBe(true);
    expect(olderMeditationContentIssue(textOnly)).toBeNull();
    const duplicated = olderMeditationFixture();
    (duplicated.printableAssets as MeditationJson[]).push(
      { id: '1', prompt: 'Duplicada.' },
      { id: '9', prompt: 'Fora do intervalo.' },
    );
    const cleaned = normalizeOlderMeditation(duplicated);
    expect(
      (cleaned.printableAssets as MeditationJson[]).filter(
        (asset) => asset.id === '1',
      ),
    ).toHaveLength(1);
    expect(
      (cleaned.printableAssets as MeditationJson[]).some(
        (asset) => asset.id === '9',
      ),
    ).toBe(false);
    const repeated = olderMeditationFixture();
    (activities(repeated)[1].subitems as MeditationJson[])[0].prompt = (
      activities(repeated)[0].subitems as MeditationJson[]
    )[0].prompt;
    expect(
      olderMeditationContentIssue(normalizeOlderMeditation(repeated)),
    ).toContain('repete uma pergunta');
  });
  it('rejects incomplete choices, a wrong selection key and a missing application block', () => {
    for (const options of [[], ['Uma', 'Uma', 'Outra']]) {
      const content = olderMeditationFixture();
      (activities(content)[1].subitems as MeditationJson[])[0].options =
        options;
      expect(
        olderMeditationContentIssue(normalizeOlderMeditation(content)),
      ).not.toBeNull();
    }
    const wrong = olderMeditationFixture();
    (activities(wrong)[1].subitems as MeditationJson[])[0].answer =
      'Resposta ausente das alternativas';
    expect(
      olderMeditationContentIssue(normalizeOlderMeditation(wrong)),
    ).toContain('gabarito');
    // Goals are internal labels, repaired locally instead of regenerating.
    const noApplication = normalizeOlderMeditation(
      (() => {
        const content = olderMeditationFixture();
        activities(content).forEach((item) => (item.goal = 'NARRATIVE'));
        return content;
      })(),
    );
    expect(olderMeditationContentIssue(noApplication)).toBeNull();
    expect(activities(noApplication).at(-1)?.goal).toBe('APPLICATION');
    const lateNarrative = olderMeditationFixture();
    activities(lateNarrative)[0].goal = 'COMPREHENSION';
    expect(activities(normalizeOlderMeditation(lateNarrative))[0].goal).toBe(
      'NARRATIVE',
    );
    // A key written as the option's letter or with other punctuation is matched.
    const letter = olderMeditationFixture();
    const item = (activities(letter)[1].subitems as MeditationJson[])[0];
    const options = item.options as string[];
    item.answer = `(${String.fromCharCode(65 + options.indexOf(String(item.answer)))})`;
    expect(
      olderMeditationContentIssue(normalizeOlderMeditation(letter)),
    ).toBeNull();
  });
  it('requires a real word-search grid and checks its words instead of assuming an image exists', () => {
    const content = olderMeditationFixture();
    activities(content)[0] = {
      ...activities(content)[0],
      mechanic: M.WORD_SEARCH,
      supportText: 'Caça-palavras\nPalavras: AMOR, CUIDADO.',
      subitems: [
        {
          prompt: 'Encontre as palavras.',
          options: [],
          answer: 'Posições das palavras.',
        },
      ],
    };
    expect(
      olderMeditationContentIssue(normalizeOlderMeditation(content)),
    ).toContain('lista e grade');
    activities(content)[0].supportText =
      'Caça-palavras\nA M O R A B C\nC U I D A D O\nB C D E F G H\nPalavras: AMOR, CUIDADO';
    expect(
      olderMeditationContentIssue(normalizeOlderMeditation(content)),
    ).toBeNull();
    expect(
      olderMeditationInstructionWords(
        'Caça-palavras\nA M O R\nJ E S U S\nPalavras: AMOR',
      ),
    ).toBe(3);
  });
  it('rejects too much prose and does not add the internal key or evidence to printable instructions', () => {
    const content = normalizeOlderMeditation(olderMeditationFixture());
    const first = activities(content)[0];
    expect(first.instruction).not.toContain('a) caminho');
    expect(first.instruction).not.toContain(first.sourceExcerpt);
    const long = olderMeditationFixture();
    activities(long)[2].context = 'Texto longo. '.repeat(100);
    expect(
      olderMeditationContentIssue(normalizeOlderMeditation(long)),
    ).toContain('contexto breve');
  });
});

describe('olderMeditationReadingWords', () => {
  it('conta só o que a criança lê, não a grade, o código ou a frase cifrada', () => {
    const cipher = Array.from({ length: 60 }, () => 'J1S5S').join(' ');
    const words = olderMeditationReadingWords({
      context: 'Jesus demorou a chegar a Betânia.',
      command: 'Substitua os números pelas letras e descubra a frase.',
      supportText: `1 = E | 2 = A | 3 = I | 4 = O | 5 = U\n${cipher}\n# . . 1 . #\n. . # . . .`,
      subitems: [{ prompt: 'Escreva a frase.', options: [], answer: 'x' }],
    });
    expect(words).toBe(6 + 9 + 3);
  });

  it('soma enunciados e alternativas dos subitens', () => {
    expect(
      olderMeditationReadingWords({
        context: 'Lázaro morreu.',
        command: 'Circule.',
        subitems: [
          {
            prompt: 'Quantos dias?',
            options: ['dois', 'quatro'],
            answer: 'quatro',
          },
        ],
      }),
    ).toBe(2 + 1 + 2 + 2);
  });
});

describe('escolhas da meditação dos maiores como nas folhas impressas', () => {
  it('aceita duas alternativas e explica o gabarito que não bate', () => {
    const two = olderMeditationFixture();
    const item = (activities(two)[1].subitems as MeditationJson[])[0];
    item.options = ['Marta', 'Maria'];
    item.answer = 'Marta';
    expect(
      olderMeditationContentIssue(normalizeOlderMeditation(two)),
    ).toBeNull();
    item.answer = 'Lázaro';
    expect(
      olderMeditationContentIssue(normalizeOlderMeditation(two)),
    ).toContain(
      'Desafio 2: item a) o gabarito "Lázaro" não é igual a nenhuma alternativa (Marta / Maria)',
    );
  });
});
