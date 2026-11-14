import { withMissingActivityArt } from './meditation-assets.utils';

const activity = (number: number, instruction: string) => ({
  number,
  instruction,
  answer: 'resposta',
});

describe('withMissingActivityArt (meditação dos menores)', () => {
  it('acrescenta a arte da atividade que pede para observar figuras', () => {
    const content = withMissingActivityArt({
      activities: [
        activity(1, 'Ajude Lázaro a encontrar o caminho.'),
        activity(
          2,
          'Observe as três figuras abaixo e marque com um círculo aquela que representa o que Abraão disse.',
        ),
      ],
      printableAssets: [{ id: '1', prompt: 'Labirinto', purpose: 'Percurso' }],
    });
    const assets = content.printableAssets as Array<Record<string, unknown>>;
    expect(assets.map((asset) => asset.id)).toEqual(['1', '2']);
    expect(String(assets[1].prompt)).toContain(
      'somente os elementos indispensáveis citados',
    );
  });

  it('não mexe quando as duas atividades já têm arte', () => {
    const complete = {
      activities: [
        activity(1, 'Circule o lugar certo.'),
        activity(2, 'Ligue cada personagem.'),
      ],
      printableAssets: [
        { id: '1', prompt: 'Três lugares' },
        { id: '2', prompt: 'Personagens e destinos' },
      ],
    };
    expect(withMissingActivityArt(complete)).toBe(complete);
  });

  it('deixa sem arte a múltipla escolha escrita da atividade 2', () => {
    const textOnly = {
      activities: [
        activity(1, 'Ajude o semeador a encontrar a terra boa no labirinto.'),
        activity(
          2,
          'Circule a alternativa correta: a) Onde o homem vivia? casa / sepulcros / barco',
        ),
      ],
      printableAssets: [{ id: '1', prompt: 'Labirinto' }],
    };
    expect(withMissingActivityArt(textOnly)).toBe(textOnly);
  });

  it('a atividade 1 sempre recebe arte', () => {
    const content = withMissingActivityArt({
      activities: [activity(1, 'Circule a resposta certa: sim ou não.')],
      printableAssets: [],
    });
    expect(
      (content.printableAssets as Array<Record<string, unknown>>).map(
        (asset) => asset.id,
      ),
    ).toEqual(['1']);
  });
});
