import { Logger } from '@nestjs/common';
import {
  createOlderMeditation,
  createOlderMeditationImages,
  reviewOlderMeditation,
} from './older-meditation-generation.utils';
import {
  olderMeditationFixture,
  OLDER_MEDITATION_SOURCE,
} from '../fixtures/older-meditation.fixture';
import { normalizeOlderMeditation } from './older-meditation-quality.utils';
import { LessonStageType } from '../enums/lesson.enums';
import { LESSON_TEMPLATES } from '../templates/lesson-templates';
import type {
  LessonLlmGenerationInput,
  LessonLlmGenerationResult,
  LessonLlmProviderContract,
} from '../providers/lesson-llm.types';
import type { MeditationJson } from '../types/younger-meditation.types';

const input: LessonLlmGenerationInput = {
  theme: 'O bom samaritano',
  biblicalReference: 'Lucas 10:25-37',
  weekNumber: 5,
  stage: LessonStageType.MEDITATION_OLDER,
  template: LESSON_TEMPLATES[LessonStageType.MEDITATION_OLDER],
  approvedUpstream: OLDER_MEDITATION_SOURCE,
  adminPrompt: 'Use linguagem simples.',
  revisionInstructions: 'Preserve a mecânica.',
};
const png = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aS1sAAAAASUVORK5CYII=',
  'base64',
);
function provider() {
  return {
    generateStage: jest.fn<
      Promise<LessonLlmGenerationResult>,
      [LessonLlmGenerationInput]
    >(),
    generateImage: jest
      .fn<
        ReturnType<LessonLlmProviderContract['generateImage']>,
        Parameters<LessonLlmProviderContract['generateImage']>
      >()
      .mockResolvedValue(png),
  };
}

describe('older meditation generation', () => {
  it('accepts a shorter complete activity without any extra AI call', async () => {
    const llm = provider();
    const content = olderMeditationFixture();
    const first = (content.activities as MeditationJson[])[0];
    first.subitems = (first.subitems as MeditationJson[]).slice(0, 2);
    await expect(
      createOlderMeditation(llm, input, { content, responseId: 'initial' }),
    ).resolves.toMatchObject({ responseId: 'initial' });
    // No AI reviewer: a complete sheet that fits is saved as generated.
    expect(llm.generateStage).not.toHaveBeenCalled();
  });
  it('logs counts and phases without printing worksheet content and accepts short introductions without correction', async () => {
    const log = jest
      .spyOn(Logger.prototype, 'log')
      .mockImplementation(() => undefined);
    try {
      const llm = provider();
      const content = olderMeditationFixture();
      content.introduction = 'Reflita sobre a história.';
      await createOlderMeditation(llm, input, {
        content,
        responseId: 'initial',
      });
      const lines = log.mock.calls.map((args) => String(args[0])).join('\n');
      expect(lines).toContain('introductionWords":4');
      expect(lines).toContain('phase=local-validation');
      expect(lines).toContain('phase=completed');
      expect(lines).not.toContain(content.introduction);
      expect(llm.generateStage).not.toHaveBeenCalled();
    } finally {
      log.mockRestore();
    }
  });
  it('asks once for one more question when the sheet leaves the page half empty', async () => {
    const llm = provider();
    const content = olderMeditationFixture();
    // Two short questions leave most of the page blank.
    const items = content.activities as MeditationJson[];
    content.activities = [items[0], items[items.length - 1]];
    content.printableAssets = (
      content.printableAssets as MeditationJson[]
    ).filter((asset) => asset.id === '1');
    llm.generateStage.mockResolvedValueOnce({ content, responseId: 'fuller' });
    const result = await createOlderMeditation(llm, input, {
      content,
      responseId: 'initial',
    });
    expect(result.responseId).toBe('fuller');
    expect(llm.generateStage).toHaveBeenCalledTimes(1);
    expect(
      String(llm.generateStage.mock.calls[0][0].revisionInstructions),
    ).toContain('Acrescente uma questão curta');
  });
  it('asks once for a shorter sheet when it does not fit, then saves it for editing', async () => {
    const warn = jest
      .spyOn(Logger.prototype, 'warn')
      .mockImplementation(() => undefined);
    try {
      const llm = provider();
      const content = olderMeditationFixture();
      // A theme this long overflows the page whatever the model writes.
      content.title = 'Título '.repeat(150);
      const longInput = { ...input, theme: String(content.title) };
      llm.generateStage.mockResolvedValueOnce({
        content,
        responseId: 'shorter',
      });
      await expect(
        createOlderMeditation(llm, longInput, {
          content,
          responseId: 'initial',
        }),
      ).resolves.toMatchObject({ responseId: 'shorter' });
      // One shortening request, never a second one.
      expect(llm.generateStage).toHaveBeenCalledTimes(1);
      expect(
        String(llm.generateStage.mock.calls[0][0].revisionInstructions),
      ).toContain('do espaço de uma página A4');
      const logs = warn.mock.calls.map((args) => String(args[0])).join('\n');
      expect(logs).toContain('next=shorten');
      expect(logs).toContain('next=save-for-editing');
    } finally {
      warn.mockRestore();
    }
  });
  it('still blocks a genuinely incorrect answer during text review', async () => {
    const llm = provider();
    llm.generateStage.mockResolvedValue({
      content: {
        issues: [
          {
            activityNumber: 2,
            severity: 'BLOCKER',
            code: 'ANSWER_KEY',
            reason: 'A alternativa marcada contradiz a resposta da lição.',
          },
        ],
      },
      responseId: 'review',
    });
    await expect(
      reviewOlderMeditation(
        llm,
        input,
        normalizeOlderMeditation(olderMeditationFixture()),
      ),
    ).resolves.toEqual([
      {
        activityNumber: 2,
        reason: 'A alternativa marcada contradiz a resposta da lição.',
      },
    ]);
  });
  it('ignores a false ascending-number correction for a server-calculated sequence key but still blocks source chronology errors', async () => {
    const llm = provider();
    const data = olderMeditationFixture();
    const activity = (data.activities as MeditationJson[])[0];
    activity.mechanic = 'SEQUENCE';
    activity.sequenceEvents = [
      { story: 'Relato', text: 'O homem precisava de ajuda.', order: 1 },
      { story: 'Relato', text: 'O samaritano ajudou.', order: 2 },
    ];
    const content = normalizeOlderMeditation(data);
    llm.generateStage.mockResolvedValueOnce({
      content: {
        issues: [
          {
            activityNumber: 1,
            severity: 'BLOCKER',
            code: 'ANSWER_KEY',
            reason: 'O gabarito deve ser 1, 2 em vez de 2, 1.',
          },
        ],
      },
      responseId: 'false-key',
    });
    await expect(reviewOlderMeditation(llm, input, content)).resolves.toEqual(
      [],
    );
    llm.generateStage.mockResolvedValueOnce({
      content: {
        issues: [
          {
            activityNumber: 1,
            severity: 'BLOCKER',
            code: 'SOURCE_FACT',
            reason:
              'A ajuda foi colocada antes da necessidade, contrariando a fonte.',
          },
        ],
      },
      responseId: 'source-error',
    });
    await expect(
      reviewOlderMeditation(llm, input, content),
    ).resolves.toHaveLength(1);
    (content.activities as MeditationJson[])[0].subitems = [
      { prompt: 'Ordem', options: [], answer: '1, 2' },
    ];
    llm.generateStage.mockResolvedValueOnce({
      content: {
        issues: [
          {
            activityNumber: 1,
            severity: 'BLOCKER',
            code: 'ANSWER_KEY',
            reason: 'Gabarito adulterado.',
          },
        ],
      },
      responseId: 'bad-key',
    });
    await expect(
      reviewOlderMeditation(llm, input, content),
    ).resolves.toHaveLength(1);
  });
  it('bounds corrections and rejects invalid review results instead of silently accepting them', async () => {
    const llm = provider();
    const invalid = { content: { activities: [] }, responseId: 'invalid' };
    llm.generateStage.mockResolvedValue(invalid);
    await expect(
      createOlderMeditation(llm as LessonLlmProviderContract, input, invalid),
    ).rejects.toThrow('sem progresso');
    expect(llm.generateStage).toHaveBeenCalledTimes(1);
    llm.generateStage.mockResolvedValue({
      content: {},
      responseId: 'bad-review',
    });
    await expect(
      reviewOlderMeditation(llm as LessonLlmProviderContract, input, {}),
    ).rejects.toThrow('verificável');
  });
  it('generates art only for the questions marked visualRequired', async () => {
    const llm = provider();
    llm.generateStage.mockResolvedValue({
      content: { issues: [] },
      responseId: 'images-ok',
    });
    const result = await createOlderMeditationImages(
      llm as LessonLlmProviderContract,
      input,
      normalizeOlderMeditation(olderMeditationFixture()),
    );
    expect([...result.keys()]).toEqual(['1']);
    expect(llm.generateImage).toHaveBeenCalledTimes(1);
    // No AI image reviewer.
    expect(llm.generateStage).not.toHaveBeenCalled();
  });
  it('skips image generation when no question needs art', async () => {
    const llm = provider();
    const content = normalizeOlderMeditation(olderMeditationFixture());
    (content.activities as MeditationJson[])[0].visualRequired = false;
    content.printableAssets = [];
    const images = await createOlderMeditationImages(
      llm as LessonLlmProviderContract,
      input,
      content,
    );
    expect(images.size).toBe(0);
    expect(llm.generateImage).not.toHaveBeenCalled();
    expect(llm.generateStage).not.toHaveBeenCalled();
  });

  describe('revisor da meditação dos maiores que desmente o próprio issue', () => {
    it('não bloqueia um BLOCKER que o revisor marcou como não confirmado', async () => {
      const llm = provider();
      const content = normalizeOlderMeditation(olderMeditationFixture());
      llm.generateStage.mockResolvedValueOnce({
        content: {
          issues: [
            {
              activityNumber: 1,
              reason:
                'A ordem correta é 4, 1, 5, 3, 2. Contudo, o gabarito já corresponde a essa ordem, então não há contradição.',
              code: 'SOURCE_FACT',
              severity: 'BLOCKER',
              confirmed: false,
            },
          ],
        },
        responseId: 'retracted',
      });
      await expect(reviewOlderMeditation(llm, input, content)).resolves.toEqual(
        [],
      );
    });
  });
});
