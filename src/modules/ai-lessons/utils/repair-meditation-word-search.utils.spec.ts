import { repairMeditationWordSearch } from './repair-meditation-word-search.utils';
import { meditationWordSearchIssue } from './meditation-word-search.utils';

describe('repair meditation word search', () => {
  it('rebuilds unequal rows with every complete word, exact positions and no duplicate image', () => {
    const instruction =
      'Caça-palavras\nPIXVIÚVAJ\nQÁZARONES\nRESSUREIÇÃO\nPalavras: VIÚVA, LÁZARO, RESSURREIÇÃO';
    const original = {
      activities: [
        { id: '1', instruction, answer: 'Resposta antiga' },
        { id: '2', instruction: 'Complete.' },
      ],
      printableAssets: [
        { id: '1', prompt: 'Grade antiga' },
        { id: '2', prompt: 'Outra atividade' },
      ],
    };
    const repaired = repairMeditationWordSearch(original);
    const activities = repaired.activities as Array<Record<string, unknown>>;
    const corrected = activities[0].instruction as string;
    expect(meditationWordSearchIssue(corrected)).toBeNull();
    expect(corrected).toContain('Palavras: VIÚVA, LÁZARO, RESSURREIÇÃO');
    const grid = corrected
      .split('\n')
      .filter((line) => /^[A-Z\s]{4,}$/.test(line))
      .map((row) => row.replace(/\s/g, ''));
    expect(new Set(grid.map((row) => row.length)).size).toBe(1);
    expect(grid[1].slice(0, 5)).toBe('VIUVA');
    expect(grid[2].slice(1, 7)).toBe('LAZARO');
    expect(grid[3].slice(2, 14)).toBe('RESSURREICAO');
    expect(activities[0].answer).toContain(
      'RESSURREICAO: linha 4, coluna 3 até coluna 14',
    );
    expect(activities[1]).toBe(original.activities[1]);
    expect(repaired.printableAssets).toEqual([original.printableAssets[1]]);
    expect(original.activities[0].instruction).toBe(instruction);
    expect(repairMeditationWordSearch(repaired)).toEqual(repaired);
  });

  it('repairs missing words while leaving valid, visual and ambiguous puzzles unchanged', () => {
    const missing = {
      activities: [
        {
          instruction:
            'Caça-palavras\nJESUS\nABCDE\nFGHIJ\nPalavras: JESUS, VIDA',
        },
      ],
    };
    const repaired = repairMeditationWordSearch(missing);
    expect(
      meditationWordSearchIssue(
        (repaired.activities as Array<{ instruction: string }>)[0].instruction,
      ),
    ).toBeNull();
    for (const instruction of [
      'Caça-palavras\nJESUS\nABCDE\nFGHIJ\nPalavras: JESUS',
      'Resolva o caça-palavras ao lado.',
      'Caça-palavras\nABCDE\nFGHI\nJKLMN',
      'Caça-palavras\nABCDE\nFGHI\nJKLMN\nPalavras: JESUS, VIDA (eterna)',
      'Complete as frases.',
    ]) {
      const content = { activities: [{ instruction, answer: 'Original' }] };
      expect(repairMeditationWordSearch(content)).toEqual(content);
    }
  });
});
