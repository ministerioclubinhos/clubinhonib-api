import { buildMeditationWordSearchGrid } from './meditation-word-search-grid.utils';
import { meditationWordSearchIssue } from './meditation-word-search.utils';

describe('buildMeditationWordSearchGrid', () => {
  const words = ['ABRAAO', 'IRMAOS', 'OUVIR', 'DEUS', 'JESUS'];

  it('esconde todas as palavras numa grade de pelo menos 10 colunas', () => {
    const built = buildMeditationWordSearchGrid(words)!;
    expect(built.rows[0].split(' ').length).toBeGreaterThanOrEqual(10);
    const instruction = [
      'Caça-palavras',
      `Palavras: ${words.join(', ')}`,
      ...built.rows,
    ].join('\n');
    expect(meditationWordSearchIssue(instruction)).toBeNull();
    expect(built.positions).toHaveLength(words.length);
  });

  it('não preenche com o alfabeto em ordem nem põe uma palavra por linha', () => {
    const built = buildMeditationWordSearchGrid(words)!;
    const joined = built.rows.map((row) => row.replace(/ /g, '')).join('\n');
    expect(joined).not.toMatch(/ABCDEF|XYZ/);
    // Words go in more than one direction.
    const directions = new Set(
      built.positions.map((line) => line.split(', ').pop()),
    );
    expect(directions.size).toBeGreaterThan(1);
  });

  it('gera sempre a mesma grade para a mesma lista', () => {
    expect(buildMeditationWordSearchGrid(words)).toEqual(
      buildMeditationWordSearchGrid(words),
    );
  });
});
