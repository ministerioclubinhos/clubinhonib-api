import {
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
    'Pense no que aprendeu.',
    'Recorde a história e observe as atitudes das pessoas.',
  ])('accepts short meaningful introductions: %s', (introduction) => {
    const content = olderMeditationFixture();
    content.introduction = introduction;
    expect(
      olderMeditationContentIssue(normalizeOlderMeditation(content)),
    ).toBeNull();
  });
  it.each(['', 'palavra '.repeat(46)])(
    'rejects empty or oversized introductions',
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
      '(1) Verdadeiro   (2) Falso',
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
    activities(content)[0].sourceExcerpt = '  ';
    expect(
      olderMeditationContentIssue(normalizeOlderMeditation(content)),
    ).toContain('falta o trecho');
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
  it('rejects image/text duplication, missing visual assets and repeated questions', () => {
    const duplicate = olderMeditationFixture();
    duplicate.printableAssets = [
      { id: '1', prompt: 'Repita o exercício e acrescente um caça-palavras.' },
    ];
    expect(
      olderMeditationContentIssue(normalizeOlderMeditation(duplicate)),
    ).toContain('arte');
    const missing = olderMeditationFixture();
    missing.printableAssets = [];
    expect(
      olderMeditationContentIssue(normalizeOlderMeditation(missing)),
    ).toContain('arte');
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
    const noApplication = olderMeditationFixture();
    activities(noApplication)[2].goal = 'NARRATIVE';
    expect(
      olderMeditationContentIssue(normalizeOlderMeditation(noApplication)),
    ).toContain('aplicação');
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
