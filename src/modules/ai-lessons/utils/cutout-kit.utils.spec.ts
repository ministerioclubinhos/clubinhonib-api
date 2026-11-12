import { ConflictException } from '@nestjs/common';
import {
  CUTOUT_KIT_TIERS,
  cutoutKitTierSummary,
} from '../constants/story-visual-quality.constants';
import { buildCutoutKitImagePrompt } from '../utils';
import {
  cutoutKitGenerationOrder,
  isLiteralStoryEvidence,
  markUnsupportedCutoutItemsAsExtra,
  normalizeCutoutKitStructure,
  repairCutoutStoryEvidence,
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

describe('markUnsupportedCutoutItemsAsExtra', () => {
  const pombo = () =>
    item({ label: 'Pombo', category: 'ANIMALS', storyEvidence: '' });

  it('turns an element without story evidence into an extra, so the kit is not rejected for it', () => {
    const kit = validKit();
    kit.assets[0].items.push(pombo());
    // This is the failure seen in production: one context animal, no evidence.
    expect(() => validateCutoutKit(kit, story, 4)).toThrow(/Pombo/);

    expect(markUnsupportedCutoutItemsAsExtra(kit)).toEqual(['Pombo']);

    expect(kit.assets[0].items.at(-1)).toMatchObject({ extra: true });
    expect(() => validateCutoutKit(kit, story, 4)).not.toThrow();
  });

  it('leaves supported, already-extra and neutral sky elements untouched', () => {
    const kit = validKit();
    kit.assets[3].items.push(
      item({ label: 'Nuvens', category: 'SKY_AND_NATURE', storyEvidence: '' }),
    );
    const before = JSON.stringify(kit);

    expect(markUnsupportedCutoutItemsAsExtra(kit)).toEqual([]);
    expect(JSON.stringify(kit)).toBe(before);
  });

  it('does not excuse invented evidence: a quote that is not in the lesson still fails', () => {
    const kit = validKit();
    kit.assets[0].items[0].storyEvidence = 'Maria voou até a lua';

    expect(markUnsupportedCutoutItemsAsExtra(kit)).toEqual([]);
    expect(() => validateCutoutKit(kit, story, 4)).toThrow(/storyEvidence/);
  });

  it('tolerates a kit without sheets or items', () => {
    expect(markUnsupportedCutoutItemsAsExtra({})).toEqual([]);
    expect(markUnsupportedCutoutItemsAsExtra({ assets: [{}] })).toEqual([]);
  });
});

describe('story evidence', () => {
  const lesson =
    'Jesus chamou uma criança e a colocou no meio deles. Então disse: “Quem se faz humilde como esta criança, este é o maior”. Os discípulos ficaram em silêncio.';

  it('accepts a quote that differs only in punctuation, quotes, accents or case', () => {
    expect(
      isLiteralStoryEvidence(
        'jesus chamou uma crianca, e a colocou no meio deles',
        lesson,
      ),
    ).toBe(true);
    expect(
      isLiteralStoryEvidence('"Quem se faz humilde como esta criança"', lesson),
    ).toBe(true);
  });

  it('accepts a quote abbreviated with reticences when every part is in the lesson', () => {
    expect(
      isLiteralStoryEvidence(
        'Jesus chamou uma criança ... este é o maior',
        lesson,
      ),
    ).toBe(true);
    expect(
      isLiteralStoryEvidence(
        'Jesus chamou uma criança ... e voou para longe',
        lesson,
      ),
    ).toBe(false);
  });

  it('rejects a paraphrase', () => {
    expect(
      isLiteralStoryEvidence(
        'Jesus pegou um menino para ensinar os amigos',
        lesson,
      ),
    ).toBe(false);
  });

  it('replaces a paraphrased quote with the real sentence that mentions the element', () => {
    const kit = {
      assets: [
        {
          items: [
            item({
              label: 'Jesus',
              storyEvidence: 'Jesus pegou um menino para ensinar os amigos',
            }),
          ],
        },
      ],
    };

    expect(repairCutoutStoryEvidence(kit, lesson)).toEqual({
      requoted: ['Jesus'],
      demoted: [],
    });
    expect(kit.assets[0].items[0].storyEvidence).toBe(
      'Jesus chamou uma criança e a colocou no meio deles.',
    );
    expect(kit.assets[0].items[0].extra).toBe(false);
  });

  it('finds the element by its main word when the label carries a qualifier', () => {
    const kit = {
      assets: [
        {
          items: [
            item({
              label: 'Discípulos sentados',
              storyEvidence: 'os amigos dele',
            }),
          ],
        },
      ],
    };

    repairCutoutStoryEvidence(kit, lesson);

    expect(kit.assets[0].items[0].storyEvidence).toBe(
      'Os discípulos ficaram em silêncio.',
    );
  });

  it('drops the false quote and turns the element into an extra when the lesson never mentions it', () => {
    const kit = {
      assets: [
        {
          items: [
            item({
              label: 'Camelo',
              category: 'ANIMALS',
              storyEvidence: 'um camelo passava',
            }),
          ],
        },
      ],
    };

    expect(repairCutoutStoryEvidence(kit, lesson)).toEqual({
      requoted: [],
      demoted: ['Camelo'],
    });
    expect(kit.assets[0].items[0]).toMatchObject({
      storyEvidence: '',
      extra: true,
    });
  });

  it('leaves correct evidence and empty evidence alone', () => {
    const kit = {
      assets: [
        {
          items: [
            item({ label: 'Jesus', storyEvidence: 'Jesus chamou uma criança' }),
            item({
              label: 'Nuvens',
              category: 'SKY_AND_NATURE',
              storyEvidence: '',
            }),
          ],
        },
      ],
    };
    const before = JSON.stringify(kit);

    expect(repairCutoutStoryEvidence(kit, lesson)).toEqual({
      requoted: [],
      demoted: [],
    });
    expect(JSON.stringify(kit)).toBe(before);
  });
});

describe('normalizeCutoutKitStructure', () => {
  it('renumbers sheets, fills a missing size and rebuilds the coverage list from what the kit holds', () => {
    const kit = validKit() as unknown as {
      assets: { id: string; items: Record<string, unknown>[] }[];
      coverageChecklist: Record<string, unknown>[];
    };
    kit.assets[0].id = 'kit-1';
    kit.assets[2].id = 'prancha-3';
    kit.assets[1].items[0].size = 'HUGE';
    // Declared as covered with no item, and one category missing altogether.
    kit.coverageChecklist = [{ category: 'ANIMALS', status: 'COVERED' }];
    expect(() => validateCutoutKit(kit, story, 4)).toThrow(ConflictException);

    normalizeCutoutKitStructure(kit);

    expect(kit.assets.map((asset) => asset.id)).toEqual([
      'kit-01',
      'kit-02',
      'kit-03',
      'kit-04',
    ]);
    expect(kit.assets[1].items[0].size).toBe('MEDIUM');
    expect(
      kit.coverageChecklist.find((entry) => entry.category === 'ANIMALS'),
    ).toMatchObject({ status: 'NOT_APPLICABLE' });
    expect(
      kit.coverageChecklist.find((entry) => entry.category === 'CHARACTERS'),
    ).toMatchObject({ status: 'COVERED' });
    expect(() => validateCutoutKit(kit, story, 4)).not.toThrow();
  });

  it('does not hide a content problem: the wrong number of sheets still fails', () => {
    const kit = validKit();
    normalizeCutoutKitStructure(kit);

    expect(() => validateCutoutKit(kit, story, 6)).toThrow(/exatamente 6/);
  });
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
      category: 'CHARACTERS',
      items: [item()],
      proposedComposition: 'duas linhas',
      hasIdentityReference: true,
    });
    expect(prompt).toContain('Prancha de elementos para recortar');
    expect(prompt).toContain('Fundo branco puro');
    expect(prompt).toContain('imagem anexada é SOMENTE um guia de estilo');
    expect(prompt).toContain('Maria');
  });

  it('treats the sheet as a closed list and leaves the lesson text out', () => {
    // Regression: with the whole story (and reference images) in the prompt,
    // the "Animais" sheet came back with characters, scroll, house and trees.
    const prompt = buildCutoutKitImagePrompt({
      category: 'ANIMALS',
      title: 'Animais',
      items: [item({ label: 'Pomba', category: 'ANIMALS' })],
      proposedComposition: 'uma pomba',
      hasIdentityReference: true,
    });
    expect(prompt).toContain('exatamente 1 elemento — Pomba');
    expect(prompt).toContain('NÃO redesenhe');
    expect(prompt).toContain('deve mostrar somente Pomba (1 elemento)');
    expect(prompt).not.toContain('LIÇÃO BÍBLICA COMPLETA');
    expect(prompt).not.toContain(story);
  });
});
