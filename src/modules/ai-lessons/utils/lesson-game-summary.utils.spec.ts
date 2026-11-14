import { LessonImagePurpose } from '../providers/lesson-llm.types';
import { buildGameSummaryImagePrompt } from '../utils';
import { lessonImageTextPolicy } from './meditation-image.utils';
import { isGameSummaryAssetList } from './lesson-game-summary.utils';

describe('isGameSummaryAssetList', () => {
  it('reconhece a imagem única do compilado', () => {
    expect(isGameSummaryAssetList([{ id: 'compilado-01' }])).toBe(true);
  });

  it('não confunde brincadeiras antigas com uma imagem por passo', () => {
    expect(isGameSummaryAssetList([{ id: 'instrucao-01' }])).toBe(false);
    expect(
      isGameSummaryAssetList([{ id: 'compilado-01' }, { id: 'instrucao-02' }]),
    ).toBe(false);
  });

  it('ignora valores que não são listas de imagens', () => {
    expect(isGameSummaryAssetList(undefined)).toBe(false);
    expect(isGameSummaryAssetList([])).toBe(false);
    expect(isGameSummaryAssetList([null])).toBe(false);
  });
});

describe('imagem de compilado da brincadeira com texto', () => {
  it('libera rótulos escritos somente para o compilado', () => {
    const policy = lessonImageTextPolicy(LessonImagePurpose.GAME_SUMMARY);
    expect(policy).toContain(
      'Nenhuma faixa, placa ou etiqueta pode ficar em branco',
    );
    expect(policy).not.toContain('Sem letras');
    expect(lessonImageTextPolicy()).toContain('Sem letras');
  });

  it('pede o título exato e as faixas da brincadeira', () => {
    const prompt = buildGameSummaryImagePrompt({
      game: {
        name: 'Sinais para Hoje',
        steps: ['Passo 1', 'Passo 2', 'Passo 3'],
      },
      proposedComposition: 'Infográfico vertical.',
    });
    expect(prompt).toContain('título "Sinais para Hoje"');
    expect(prompt).toContain('"MATERIAIS", "PREPARAÇÃO" e "COMO BRINCAR"');
    expect(prompt).toContain('exatamente 3 paradas numeradas');
    expect(prompt).toContain('UMA ÚNICA BRINCADEIRA');
  });
});
