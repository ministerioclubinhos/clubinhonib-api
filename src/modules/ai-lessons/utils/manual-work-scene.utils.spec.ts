import { MANUAL_WORK_SCENE_FOCUSES } from '../constants/manual-work-scene.constants';
import { buildLessonSystemPrompt } from './lesson-system-prompt.utils';
import { LessonStageType } from '../enums/lesson.enums';
import { getLessonTemplate } from '../templates/special-lesson-templates';
import { buildManualWorkImagePrompt } from './manual-work-image.utils';
import {
  manualWorkPreviousScenes,
  manualWorkSceneFocus,
} from './manual-work-scene.utils';

describe('manual work scene variety', () => {
  it('rotates through every moment of the story and wraps around', () => {
    const picked = MANUAL_WORK_SCENE_FOCUSES.map((_, index) =>
      manualWorkSceneFocus(index),
    );
    expect(new Set(picked).size).toBe(MANUAL_WORK_SCENE_FOCUSES.length);
    expect(manualWorkSceneFocus(MANUAL_WORK_SCENE_FOCUSES.length)).toBe(
      picked[0],
    );
    expect(manualWorkSceneFocus(-3)).toBe(picked[0]);
  });
  it('lists the scenes already drawn once each, keeping the latest ones', () => {
    const version = (prompt?: string) => ({
      printableAssets: prompt ? [{ id: '1', prompt }] : [],
    });
    expect(
      manualWorkPreviousScenes([
        version('Rico à mesa'),
        version(),
        null,
        version('Rico à mesa'),
        version('Lázaro à porta'),
      ]),
    ).toEqual([{ name: 'Rico à mesa' }, { name: 'Lázaro à porta' }]);
    const many = Array.from({ length: 20 }, (_, index) =>
      version(`Cena ${index}`),
    );
    const scenes = manualWorkPreviousScenes(many);
    expect(scenes).toHaveLength(12);
    expect(scenes[11]).toEqual({ name: 'Cena 19' });
  });
  it('asks the model for the chosen moment and bans the earlier scenes', () => {
    const prompt = buildLessonSystemPrompt({
      theme: 'Lázaro e o rico',
      biblicalReference: 'Lucas 16:19-31',
      stage: LessonStageType.MANUAL_WORK,
      template: getLessonTemplate(LessonStageType.MANUAL_WORK),
      approvedUpstream: null,
      adminPrompt: '',
      sceneFocus: manualWorkSceneFocus(2),
    } as Parameters<typeof buildLessonSystemPrompt>[0]);
    expect(prompt).toContain('CENA DESTA GERAÇÃO');
    expect(prompt).toContain('o DESFECHO');
    expect(prompt).toContain('referências negativas');
  });
  it('varies the framing of the art and never loses the base rules', () => {
    const framings = new Set(
      [0, 1, 2, 3].map((index) => buildManualWorkImagePrompt('Cena.', index)),
    );
    expect(framings.size).toBe(4);
    for (const prompt of framings) {
      expect(prompt).toContain('ENQUADRAMENTO DESTA VERSÃO');
      expect(prompt).toContain('UMA ÚNICA CENA');
    }
    expect(buildManualWorkImagePrompt('Cena.', 4)).toBe(
      buildManualWorkImagePrompt('Cena.', 0),
    );
  });
});
