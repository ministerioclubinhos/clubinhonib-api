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

describe('older meditation generation and independent review', () => {
  it('reviews content even when it satisfies all local checks and regenerates semantic failures without replacing puzzles by questionnaires', async () => {
    const llm = provider();
    const generated = {
      content: olderMeditationFixture(),
      responseId: 'initial',
    };
    llm.generateStage
      .mockResolvedValueOnce({
        content: {
          issues: [
            {
              activityNumber: 2,
              severity: 'BLOCKER',
              code: 'INCOMPLETE_EXERCISE',
              reason: 'Alternativas não exigem compreender a história.',
            },
          ],
        },
        responseId: 'review-bad',
      })
      .mockResolvedValueOnce({ ...generated, responseId: 'corrected' })
      .mockResolvedValueOnce({
        content: { issues: [] },
        responseId: 'review-ok',
      });
    const result = await createOlderMeditation(
      llm as LessonLlmProviderContract,
      input,
      generated,
    );
    expect(result.responseId).toBe('corrected');
    expect(
      llm.generateStage.mock.calls[0][0].olderMeditationReview,
    ).toBeDefined();
    const correction = llm.generateStage.mock.calls[1][0];
    expect(correction.revisionInstructions).toContain('Preserve a mecânica.');
    expect(correction.revisionInstructions).toContain(
      'Alternativas não exigem',
    );
    expect(correction).not.toHaveProperty('olderMeditationBlockRevision');
    expect(result.content.activities).toMatchObject([
      { mechanic: 'FILL_BLANK' },
      { mechanic: 'MULTIPLE_CHOICE' },
      { mechanic: 'SHORT_ANSWER' },
    ]);
  });
  it('sends paraphrased evidence to the reviewer with the approved source instead of failing literal matching', async () => {
    const llm = provider();
    const content = olderMeditationFixture();
    (content.activities as MeditationJson[])[0].sourceExcerpt =
      'Um viajante ferido recebeu ajuda e cuidados de um samaritano.';
    llm.generateStage.mockResolvedValue({
      content: { issues: [] },
      responseId: 'review-ok',
    });
    await expect(
      createOlderMeditation(llm, input, { content, responseId: 'initial' }),
    ).resolves.toMatchObject({ responseId: 'initial' });
    expect(llm.generateStage).toHaveBeenCalledTimes(1);
    expect(llm.generateStage.mock.calls[0][0]).toMatchObject({
      approvedUpstream: OLDER_MEDITATION_SOURCE,
      olderMeditationReview: {
        content: {
          activities: [
            {
              sourceExcerpt: (content.activities as MeditationJson[])[0]
                .sourceExcerpt,
            },
            {},
            {},
          ],
        },
      },
    });
  });
  it('still rejects unsupported facts through semantic review after bounded corrections', async () => {
    const llm = provider();
    const content = olderMeditationFixture();
    (content.activities as MeditationJson[])[0].sourceExcerpt =
      'O samaritano viajou de avião.';
    llm.generateStage.mockImplementation((request) =>
      Promise.resolve(
        request.olderMeditationReview
          ? {
              content: {
                issues: [
                  {
                    activityNumber: 1,
                    severity: 'BLOCKER',
                    code: 'INCOMPLETE_EXERCISE',
                    reason: 'A lição não relata viagem de avião.',
                  },
                ],
              },
              responseId: 'rejected',
            }
          : { content, responseId: 'correction' },
      ),
    );
    await expect(
      createOlderMeditation(llm, input, { content, responseId: 'initial' }),
    ).rejects.toThrow('A lição não relata viagem de avião.');
    expect(
      llm.generateStage.mock.calls.filter(
        ([request]) => request.olderMeditationReview,
      ),
    ).toHaveLength(3);
    expect(
      llm.generateStage.mock.calls.filter(
        ([request]) => !request.olderMeditationReview,
      ),
    ).toHaveLength(2);
  });
  it('reviews a shorter complete activity instead of regenerating it for a fixed count', async () => {
    const llm = provider();
    const content = olderMeditationFixture();
    const first = (content.activities as MeditationJson[])[0];
    first.subitems = (first.subitems as MeditationJson[]).slice(0, 2);
    llm.generateStage.mockResolvedValue({
      content: { issues: [] },
      responseId: 'review-ok',
    });
    await expect(
      createOlderMeditation(llm, input, { content, responseId: 'initial' }),
    ).resolves.toMatchObject({ responseId: 'initial' });
    expect(llm.generateStage).toHaveBeenCalledTimes(1);
    expect(
      llm.generateStage.mock.calls[0][0].olderMeditationReview,
    ).toBeDefined();
  });
  it('logs counts and phases without printing worksheet content and accepts short introductions without correction', async () => {
    const log = jest
      .spyOn(Logger.prototype, 'log')
      .mockImplementation(() => undefined);
    try {
      const llm = provider();
      const content = olderMeditationFixture();
      content.introduction = 'Reflita sobre a história.';
      llm.generateStage.mockResolvedValue({
        content: { issues: [] },
        responseId: 'review-ok',
      });
      await createOlderMeditation(llm, input, {
        content,
        responseId: 'initial',
      });
      const lines = log.mock.calls.map((args) => String(args[0])).join('\n');
      expect(lines).toContain('introductionWords":4');
      expect(lines).toContain('phase=local-validation');
      expect(lines).toContain('phase=text-review');
      expect(lines).toContain('phase=completed');
      expect(lines).not.toContain(content.introduction);
      expect(llm.generateStage).toHaveBeenCalledTimes(1);
    } finally {
      log.mockRestore();
    }
  });
  it('preserves semantically approved content with layout overflow without paid regeneration', async () => {
    const warn = jest
      .spyOn(Logger.prototype, 'warn')
      .mockImplementation(() => undefined);
    try {
      const llm = provider();
      const content = olderMeditationFixture();
      content.title = 'Título '.repeat(150);
      const longInput = { ...input, theme: String(content.title) };
      llm.generateStage.mockResolvedValue({
        content: { issues: [] },
        responseId: 'approved',
      });
      await expect(
        createOlderMeditation(llm, longInput, {
          content,
          responseId: 'initial',
        }),
      ).resolves.toMatchObject({ responseId: 'initial' });
      expect(llm.generateStage).toHaveBeenCalledTimes(1);
      expect(
        warn.mock.calls.map((args) => String(args[0])).join('\n'),
      ).toContain('phase=layout status=needs-editing');
      expect(
        warn.mock.calls.map((args) => String(args[0])).join('\n'),
      ).toContain('next=save-for-editing');
    } finally {
      warn.mockRestore();
    }
  });
  it('does not regenerate for editorial suggestions or images missing before image generation', async () => {
    const llm = provider();
    llm.generateStage.mockResolvedValue({
      content: {
        issues: [
          {
            activityNumber: 2,
            severity: 'SUGGESTION',
            code: 'STYLE_SUGGESTION',
            reason:
              'A atividade está correta, mas seria benéfico incluir suporte textual.',
          },
          {
            activityNumber: 3,
            severity: 'SUGGESTION',
            code: 'STYLE_SUGGESTION',
            reason: 'A instrução poderia ser mais direta.',
          },
          {
            activityNumber: 1,
            severity: 'BLOCKER',
            code: 'IMAGE_DEFECT',
            reason: 'Falta uma imagem coerente.',
          },
        ],
      },
      responseId: 'review',
    });
    await expect(
      createOlderMeditation(llm, input, {
        content: olderMeditationFixture(),
        responseId: 'initial',
      }),
    ).resolves.toMatchObject({ responseId: 'initial' });
    expect(llm.generateStage).toHaveBeenCalledTimes(1);
  });
  it('does not reopen editorial text review while inspecting generated images', async () => {
    const llm = provider();
    llm.generateStage.mockResolvedValue({
      content: {
        issues: [
          {
            activityNumber: 3,
            severity: 'BLOCKER',
            code: 'APPLICATION_MISSING',
            reason: 'Reescreva a questão.',
          },
        ],
      },
      responseId: 'image-review',
    });
    const result = await createOlderMeditationImages(
      llm,
      input,
      normalizeOlderMeditation(olderMeditationFixture()),
    );
    expect(result.size).toBe(3);
    expect(llm.generateImage).toHaveBeenCalledTimes(3);
    expect(llm.generateStage).toHaveBeenCalledTimes(1);
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
  it('generates three support images even for a textual worksheet', async () => {
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
    expect([...result.keys()]).toEqual(['1', '2', '3']);
    expect(llm.generateImage).toHaveBeenCalledTimes(3);
    expect(llm.generateStage).toHaveBeenCalledTimes(1);
  });
  it('inspects actual images, retries incorrect artwork with concrete feedback, and never changes the saved exercise', async () => {
    const llm = provider();
    const content = normalizeOlderMeditation(olderMeditationFixture());
    const activity = (content.activities as MeditationJson[])[0];
    activity.visualRequired = true;
    const snapshot = JSON.stringify(content);
    llm.generateStage
      .mockResolvedValueOnce({
        content: {
          issues: [
            {
              activityNumber: 1,
              severity: 'BLOCKER',
              code: 'IMAGE_DEFECT',
              reason: 'A arte acrescentou outro jogo e revelou a solução.',
            },
          ],
        },
        responseId: 'bad',
      })
      .mockResolvedValueOnce({ content: { issues: [] }, responseId: 'ok' });
    const images = await createOlderMeditationImages(
      llm as LessonLlmProviderContract,
      input,
      content,
    );
    expect(images.get('1')).toEqual(png);
    expect(llm.generateImage).toHaveBeenCalledTimes(4);
    expect(llm.generateImage.mock.calls[3][0]).toContain(
      'A arte acrescentou outro jogo',
    );
    expect(
      llm.generateStage.mock.calls[0][0].olderMeditationReview?.images[0].image
        .data,
    ).toEqual(png);
    expect(JSON.stringify(content)).toBe(snapshot);
  });
  it('rejects repeatedly broken artwork before uploading or publishing a version', async () => {
    const llm = provider();
    const content = normalizeOlderMeditation(olderMeditationFixture());

    llm.generateStage.mockResolvedValue({
      content: {
        issues: [
          {
            activityNumber: 2,
            severity: 'BLOCKER',
            code: 'IMAGE_DEFECT',
            reason: 'O enigma não tem solução.',
          },
        ],
      },
      responseId: 'bad',
    });
    await expect(
      createOlderMeditationImages(
        llm as LessonLlmProviderContract,
        input,
        content,
      ),
    ).rejects.toThrow('versão anterior foi preservada');
    expect(llm.generateImage).toHaveBeenCalledTimes(5);
  });
});
