import {
  normalizeCutoutKitStructure,
  validateCutoutKit,
} from 'src/modules/ai-lessons/utils/cutout-kit.utils';
import {
  fakeCutoutKit,
  fakeStoryVisuals,
  splitStory,
} from './fake-ai-visuals.utils';

const STORY =
  'Um pastor tinha cem ovelhas. Uma delas se perdeu no campo. Ele deixou as outras, procurou até achar e voltou feliz para casa.';

describe('visuais simulados', () => {
  it('divide a história inteira em trechos literais e consecutivos', () => {
    const excerpts = splitStory(STORY, 6);
    expect(excerpts).toHaveLength(6);
    expect(excerpts.every(Boolean)).toBe(true);
    expect(excerpts.join(' ')).toBe(STORY);
  });

  it('não cria trechos vazios quando a história é curta', () => {
    expect(splitStory('Jesus ama', 5)).toEqual(['Jesus', 'ama']);
  });

  it('numera os visuais como o contrato exige', () => {
    const { assets } = fakeStoryVisuals({ story: STORY, quantity: 4 });
    expect((assets as { id: string }[]).map((asset) => asset.id)).toEqual([
      'visual-01',
      'visual-02',
      'visual-03',
      'visual-04',
    ]);
  });

  it.each([4, 7, 10])(
    'monta um kit de %i pranchas aceito pelo validador real',
    (quantity) => {
      const kit = fakeCutoutKit({ story: STORY, quantity });
      normalizeCutoutKitStructure(kit);
      expect(() => validateCutoutKit(kit, STORY, quantity)).not.toThrow();
    },
  );
});
