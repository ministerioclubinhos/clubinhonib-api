import { ConflictException } from '@nestjs/common';
import {
  CUTOUT_KIT_TIERS,
  cutoutKitTierSummary,
} from '../constants/story-visual-quality.constants';
import { buildCutoutKitImagePrompt } from '../utils';
import {
  cutoutKitGenerationOrder,
  validateCutoutKit,
} from './cutout-kit.utils';

const story = 'Maria e José foram a Belém. Uma estrela brilhava no céu.';
const item = (over: Record<string, unknown> = {}) => ({
  label: 'Maria',
  description: 'Mulher de manto azul',
  category: 'CHARACTERS',
  storyEvidence: 'Maria e José foram a Belém',
  variantOf: null,
  extra: false,
  size: 'LARGE',
  ...over,
});
const sheet = (n: number, category: string, items = [item({ category })]) => ({
  id: `kit-0${n}`,
  category,
  title: category,
  items,
  layoutPlan: 'Elementos grandes em duas linhas.',
  prompt: 'x',
  altText: 'x',
});
const checklist = () =>
  [
    'CHARACTERS',
    'ANIMALS',
    'BUILDINGS',
    'SCENERY',
    'SKY_AND_NATURE',
    'OBJECTS',
  ].map((category) => ({
    category,
    status: ['ANIMALS', 'OBJECTS'].includes(category)
      ? 'NOT_APPLICABLE'
      : 'COVERED',
    justification: 'Sem animais ou objetos na lição.',
  }));
const validKit = () => ({
  assets: [
    sheet(1, 'CHARACTERS'),
    sheet(2, 'BUILDINGS', [
      item({ label: 'Belém', category: 'BUILDINGS', storyEvidence: 'Belém' }),
    ]),
    sheet(3, 'SCENERY', [
      item({
        label: 'Colina',
        category: 'SCENERY',
        storyEvidence: '',
        extra: true,
      }),
    ]),
    sheet(4, 'SKY_AND_NATURE', [
      item({
        label: 'Estrela',
        category: 'SKY_AND_NATURE',
        storyEvidence: 'Uma estrela brilhava',
      }),
    ]),
  ],
  coverageChecklist: checklist(),
});

describe('validateCutoutKit', () => {
  it('accepts a complete kit', () => {
    expect(() => validateCutoutKit(validKit(), story, 4)).not.toThrow();
  });

  it('rejects wrong ids', () => {
    const kit = validKit();
    kit.assets[1].id = 'visual-02';
    expect(() => validateCutoutKit(kit, story, 4)).toThrow(ConflictException);
  });

  it('rejects storyEvidence that is not in the lesson', () => {
    const kit = validKit();
    kit.assets[0].items[0].storyEvidence = 'Frase inventada';
    expect(() => validateCutoutKit(kit, story, 4)).toThrow(/storyEvidence/);
  });

  it('rejects incomplete coverage checklist', () => {
    const kit = validKit();
    kit.coverageChecklist.pop();
    expect(() => validateCutoutKit(kit, story, 4)).toThrow(/coverageChecklist/);
  });

  it('rejects NOT_APPLICABLE without justification', () => {
    const kit = validKit();
    kit.coverageChecklist[1].justification = '';
    expect(() => validateCutoutKit(kit, story, 4)).toThrow(/justificativa/);
  });

  it('requires sky items', () => {
    const kit = validKit();
    kit.assets.pop();
    kit.coverageChecklist[4].status = 'NOT_APPLICABLE';
    expect(() => validateCutoutKit(kit, story, 3)).toThrow(/SKY_AND_NATURE/);
  });

  it('requires extras beyond four sheets', () => {
    const kit = validKit();
    kit.assets.push(sheet(5, 'OBJECTS'));
    kit.assets[2].items[0].extra = false;
    kit.assets[2].items[0].storyEvidence = 'Belém';
    expect(() => validateCutoutKit(kit, story, 5)).toThrow(/extra true/);
  });
});

describe('cutout kit tiers', () => {
  it('keeps the basic set and grows monotonically from 4 to 10', () => {
    for (let n = 5; n <= 10; n++) {
      const previous = CUTOUT_KIT_TIERS[n - 1].sheets.flat();
      const current = CUTOUT_KIT_TIERS[n].sheets.flat();
      expect(CUTOUT_KIT_TIERS[n].sheets).toHaveLength(n);
      previous.forEach((category) => expect(current).toContain(category));
      expect(current.length).toBeGreaterThanOrEqual(previous.length);
      expect(cutoutKitTierSummary(n).extras.length).toBe(n - 4);
    }
    const four = CUTOUT_KIT_TIERS[4].sheets.flat();
    expect(new Set(four).size).toBe(6);
    expect(cutoutKitTierSummary(4).extras).toEqual([]);
  });
});

describe('cutoutKitGenerationOrder / buildCutoutKitImagePrompt', () => {
  it('generates CHARACTERS first without reordering the array', () => {
    const assets = [{ category: 'SCENERY' }, { category: 'CHARACTERS' }];
    expect(cutoutKitGenerationOrder(assets)).toEqual([1, 0]);
  });

  it('includes isolation, white background and identity rules', () => {
    const prompt = buildCutoutKitImagePrompt({
      completeStory: story,
      category: 'CHARACTERS',
      items: [item()],
      proposedComposition: 'duas linhas',
      hasIdentityReference: true,
    });
    expect(prompt).toContain('Prancha de elementos para recortar');
    expect(prompt).toContain('Fundo branco puro');
    expect(prompt).toContain('imagem de referência anexada');
    expect(prompt).toContain('Maria');
  });
});
