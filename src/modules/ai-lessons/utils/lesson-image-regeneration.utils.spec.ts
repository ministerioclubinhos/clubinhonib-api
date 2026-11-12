import { LessonStageType } from '../enums/lesson.enums';
import {
  imageRegenerationSummary,
  isImageRegeneration,
  keptReferenceIds,
  planImageRegeneration,
  visualChoicesOfContent,
  withImageInstructions,
  withStyleContinuity,
} from './lesson-image-regeneration.utils';

const content = (urls: Array<string | undefined>) => ({
  assets: urls.map((url, index) => ({ id: index + 1, url })),
});

describe('planImageRegeneration', () => {
  it('separa as imagens mantidas das regeradas', () => {
    expect(
      planImageRegeneration(
        LessonStageType.LESSON_VISUALS,
        content(['a', 'b', 'c']),
        ['2'],
      ),
    ).toEqual({
      keptAssetUrls: { '1': 'a', '3': 'c' },
      regeneratedAssetIds: ['2'],
      totalImages: 3,
    });
  });

  it('aceita regerar todas', () => {
    const plan = planImageRegeneration(
      LessonStageType.LESSON_VISUALS,
      content(['a', 'b']),
      ['2', '1'],
    );
    expect(plan.keptAssetUrls).toEqual({});
    expect(plan.regeneratedAssetIds).toEqual(['1', '2']);
  });

  it('lê as imagens imprimíveis das etapas que as usam', () => {
    const plan = planImageRegeneration(
      LessonStageType.MANUAL_WORK,
      { printableAssets: [{ id: 'manual', url: 'a' }] },
      ['manual'],
    );
    expect(plan.regeneratedAssetIds).toEqual(['manual']);
  });

  it.each([
    ['item sem imagens', LessonStageType.LESSON, content(['a']), ['1']],
    ['lista vazia', LessonStageType.LESSON_VISUALS, { assets: [] }, ['1']],
    ['conteúdo ausente', LessonStageType.LESSON_VISUALS, null, ['1']],
    [
      'imagem ainda não gerada',
      LessonStageType.LESSON_VISUALS,
      content(['a', undefined]),
      ['1'],
    ],
    [
      'imagem desconhecida',
      LessonStageType.LESSON_VISUALS,
      content(['a']),
      ['7'],
    ],
    ['nenhuma escolhida', LessonStageType.LESSON_VISUALS, content(['a']), []],
    [
      'parte do conjunto da meditação dos maiores',
      LessonStageType.MEDITATION_OLDER,
      {
        printableAssets: [
          { id: 1, url: 'a' },
          { id: 2, url: 'b' },
        ],
      },
      ['1'],
    ],
  ])('recusa: %s', (_label, type, data, ids) => {
    expect(() => planImageRegeneration(type, data, ids)).toThrow();
  });

  it('aceita o conjunto inteiro da meditação dos maiores', () => {
    expect(
      planImageRegeneration(
        LessonStageType.MEDITATION_OLDER,
        {
          printableAssets: [
            { id: 1, url: 'a' },
            { id: 2, url: 'b' },
          ],
        },
        ['1', '2'],
      ).regeneratedAssetIds,
    ).toEqual(['1', '2']);
  });
});

describe('apoio à regeneração de imagens', () => {
  it('reaproveita as escolhas visuais da versão em uso', () => {
    expect(
      visualChoicesOfContent({
        visualConfig: {
          type: 'CUTOUT_KIT',
          orientation: 'PORTRAIT',
          quantity: 5,
        },
      }),
    ).toEqual({
      visualType: 'CUTOUT_KIT',
      visualOrientation: 'PORTRAIT',
      visualQuantity: 5,
    });
    expect(visualChoicesOfContent({}).visualQuantity).toBeUndefined();
  });

  it('acrescenta o ajuste do administrador só quando existe', () => {
    expect(withImageInstructions('PROMPT', '  ')).toBe('PROMPT');
    expect(withImageInstructions('PROMPT', undefined)).toBe('PROMPT');
    const guided = withImageInstructions('PROMPT', 'Sem texto');
    expect(guided.startsWith('PROMPT')).toBe(true);
    expect(guided.endsWith('Sem texto')).toBe(true);
  });

  it('descreve quantas imagens foram refeitas', () => {
    expect(
      imageRegenerationSummary(2, 5, {
        provider: 'openai',
        textModel: 't',
        imageModel: '',
      }),
    ).toBe('2 de 5 imagens regeradas via OpenAI; texto mantido');
    expect(imageRegenerationSummary(5, 5, undefined)).toBe(
      'Todas as 5 imagens regeradas via OpenAI; texto mantido',
    );
  });

  it('reconhece um pedido que só refaz imagens', () => {
    expect(isImageRegeneration({ regeneratedAssetIds: ['1'] })).toBe(true);
    expect(isImageRegeneration({})).toBe(false);
  });
});

describe('referências das imagens mantidas', () => {
  const ORDER = ['1', '2', '3', '4', '5'];

  it('põe primeiro a imagem que definiu a identidade, depois as vizinhas', () => {
    expect(
      keptReferenceIds(ORDER, '4', new Set(['1', '2', '3', '5']), 3),
    ).toEqual(['1', '3', '5']);
    // By default a single reference: several would be merged into one picture.
    expect(keptReferenceIds(ORDER, '4', new Set(['1', '2', '3', '5']))).toEqual(
      ['1'],
    );
  });

  it('sem a primeira, usa as mais próximas da imagem refeita', () => {
    expect(keptReferenceIds(ORDER, '1', new Set(['3', '4', '5']), 3)).toEqual([
      '3',
      '4',
      '5',
    ]);
    expect(keptReferenceIds(ORDER, '3', new Set(['2', '5']))).toEqual(['2']);
  });

  it('nunca usa a própria imagem refeita nem passa do limite', () => {
    expect(keptReferenceIds(ORDER, '2', new Set(ORDER), 2)).toEqual(['1', '3']);
    expect(keptReferenceIds(ORDER, '2', new Set())).toEqual([]);
  });

  it('acrescenta o pedido de continuidade ao fim do prompt', () => {
    const prompt = withStyleContinuity('PROMPT');
    expect(prompt.startsWith('PROMPT')).toBe(true);
    expect(prompt).toContain('mesmo traço artístico');
    expect(prompt).toContain('mesmo rosto');
    expect(prompt).toContain('NÃO reproduza');
  });
});
