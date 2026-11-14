import { AiQueueException } from 'src/shared/providers/ai-queue/ai-queue.exception';
import { AiQueueFailure } from 'src/shared/providers/ai-queue/enums';
import { LessonLlmProvider } from 'src/modules/ai-lessons/providers/lesson-llm.types';
import {
  checkIdeaPreservation,
  checkIdeaTextField,
  combineIdeaTextGuard,
  countsTowardIdeaAiLimit,
  ideaAiErrorCodeFrom,
  ideaAiProviderReady,
  ideaWordPreservation,
  isIdeaTextEdited,
  trimIdeaAiInstructions,
  withAdminInstructions,
} from './utils';
import { IdeaAiErrorCode } from './enums/ideas-section-ai.enums';
import { IDEA_AI, IDEA_AI_ADMIN_INSTRUCTIONS_PREFIX } from './constants';
import { settings } from './testing/fixtures';

describe('targeted regeneration helpers', () => {
  it('only infra failures and cancellations stay out of the limit', () => {
    expect(countsTowardIdeaAiLimit({ errorCode: null })).toBe(true);
    expect(
      countsTowardIdeaAiLimit({ errorCode: IdeaAiErrorCode.GUARD_REJECTED }),
    ).toBe(true);
    for (const errorCode of [
      IdeaAiErrorCode.CANCELLED,
      IdeaAiErrorCode.PROVIDER_NOT_CONFIGURED,
      IdeaAiErrorCode.STALLED,
      IdeaAiErrorCode.SNAPSHOT_MISSING,
      IdeaAiErrorCode.QUEUE_UNAVAILABLE,
    ])
      expect(countsTowardIdeaAiLimit({ errorCode })).toBe(false);
  });

  it('maps worker exceptions to persisted codes', () => {
    expect(
      ideaAiErrorCodeFrom(new AiQueueException(AiQueueFailure.UNAVAILABLE)),
    ).toBe(IdeaAiErrorCode.QUEUE_UNAVAILABLE);
    expect(
      ideaAiErrorCodeFrom(new Error(IdeaAiErrorCode.INVALID_PROVIDER_RESPONSE)),
    ).toBe(IdeaAiErrorCode.INVALID_PROVIDER_RESPONSE);
    expect(ideaAiErrorCodeFrom(new Error('boom'))).toBe(
      IdeaAiErrorCode.PROVIDER_REQUEST_FAILED,
    );
    expect(ideaAiErrorCodeFrom('x')).toBe(
      IdeaAiErrorCode.PROVIDER_REQUEST_FAILED,
    );
  });

  it('requires provider, key and text model', () => {
    expect(ideaAiProviderReady(settings)).toBe(true);
    expect(
      ideaAiProviderReady({
        ...settings,
        openai: { ...settings.openai, generalModel: '' },
      }),
    ).toBe(false);
    expect(
      ideaAiProviderReady({
        ...settings,
        llmProvider: 'other' as LessonLlmProvider,
      }),
    ).toBe(false);
  });

  it('trims instructions and appends them after the fixed rules', () => {
    expect(trimIdeaAiInstructions({ value: '  mais curto ' })).toBe(
      'mais curto',
    );
    expect(trimIdeaAiInstructions({ value: '   ' })).toBeUndefined();
    expect(trimIdeaAiInstructions({ value: 3 })).toBe(3);
    expect(withAdminInstructions('Base.', null)).toBe('Base.');
    expect(withAdminInstructions('Base.', 'mais curto')).toBe(
      `Base.\n${IDEA_AI_ADMIN_INSTRUCTIONS_PREFIX} mais curto`,
    );
  });

  it('ignores whitespace when detecting admin edits', () => {
    expect(isIdeaTextEdited('Uma  ideia\nboa', 'Uma ideia boa ')).toBe(false);
    expect(isIdeaTextEdited('Uma ideia boa', 'Uma ideia ótima')).toBe(true);
  });

  it('checks the length of each text field', () => {
    expect(checkIdeaTextField('Gincana', 'Gincana', 120).approved).toBe(true);
    expect(checkIdeaTextField('Gincana', '   ', 120)).toMatchObject({
      approved: false,
      violations: expect.arrayContaining([
        'O texto deve ter entre 1 e 120 caracteres.',
      ]) as unknown,
    });
  });

  it('keeps an approved field when only the other one fails', () => {
    const ok = { approved: true, violations: [] };
    const bad = { approved: false, violations: ['Um nome mudou.'] };
    const guard = combineIdeaTextGuard(ok, bad, ok);
    expect(guard.approved).toBe(false);
    expect(guard.fields?.title.approved).toBe(true);
    expect(guard.violations).toEqual(['Descrição: Um nome mudou.']);
  });

  it('a judge rejection applies to every evaluated field', () => {
    const ok = { approved: true, violations: [] };
    const judge = { approved: false, violations: ['Essência alterada.'] };
    const guard = combineIdeaTextGuard(ok, ok, judge);
    expect(guard.fields?.title).toEqual(judge);
    expect(guard.fields?.description).toEqual(judge);
    expect(guard.violations).toEqual([
      'Título: Essência alterada.',
      'Descrição: Essência alterada.',
    ]);
  });

  describe('upgrade, not a different text', () => {
    const original =
      'Separe 3 bolas e forme 2 equipes. Leia João 3:16 antes da atividade da gincana.';
    it('keeps reordered and corrected versions', () => {
      expect(
        ideaWordPreservation(
          original,
          'Forme 2 equipes e separe 3 bolas. Antes da atividade da gincana, leia João 3:16.',
        ),
      ).toBe(1);
      expect(
        checkIdeaTextField(
          original,
          'Forme 2 equipes e separe 3 bolas. Antes da atividade da gincana, leia João 3:16.',
          2000,
        ).approved,
      ).toBe(true);
    });
    it('rejects a rewrite that loses the original wording and idea', () => {
      const rewrite =
        'Organize 2 times, distribua 3 objetos e reflita sobre João 3:16 no início do encontro.';
      expect(ideaWordPreservation(original, rewrite)).toBeLessThan(0.7);
      expect(
        checkIdeaPreservation(original, rewrite, IDEA_AI.minTextPreservation),
      ).toMatch(/afastou demais do original/);
      expect(checkIdeaTextField(original, rewrite, 2000).approved).toBe(false);
    });
    it('ignores case, punctuation and short words; an empty original passes', () => {
      expect(ideaWordPreservation('GINCANA, bolas!', 'Gincana com bolas')).toBe(
        1,
      );
      expect(ideaWordPreservation('a e o', 'outro texto')).toBe(1);
    });
    it('titles use their own, lower threshold', () => {
      expect(
        checkIdeaTextField(
          'Gincana das bolas',
          'Gincana animada das bolas',
          120,
          IDEA_AI.minTitlePreservation,
        ).approved,
      ).toBe(true);
      expect(
        checkIdeaTextField(
          'Gincana das bolas',
          'Corrida de equipes',
          120,
          IDEA_AI.minTitlePreservation,
        ).approved,
      ).toBe(false);
    });
  });
});
