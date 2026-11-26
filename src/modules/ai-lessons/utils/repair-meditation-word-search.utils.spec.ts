import { repairMeditationWordSearch } from './repair-meditation-word-search.utils';
import { meditationWordSearchIssue } from './meditation-word-search.utils';

describe('repair meditation word search', () => {
  it('uses the word list rather than the Caça-palavras colon heading from the saved PDF', () => {
    const content = {
      activities: [
        {
          number: 3,
          instruction:
            'Caça-palavras: Encontre as palavras ligadas aos milagres de Jesus.\nPIXVIÚVAJ\nQÁZARONES\nRESSUREIÇÃO\nOCOIDZHLAM\nEJESUSBATT\nPOUCSNACAD\nMULTIDÃOZM\nEKPODERGYO\nPalavras: VIÚVA, JESUS, LÁZARO, RESSURREIÇÃO, PODER, MULTIDÃO',
        },
      ],
      printableAssets: [{ id: '3', url: 'obsolete-grid' }],
    };
    const repaired = repairMeditationWordSearch(content);
    const activity = (repaired.activities as Array<Record<string, unknown>>)[0];
    expect(
      meditationWordSearchIssue(activity.instruction as string),
    ).toBeNull();
    expect(activity.answer).toContain('RESSURREICAO');
    // Item 7 always keeps its three images; the support art is not removed.
    expect(repaired.printableAssets).toEqual(content.printableAssets);
  });
  it('rebuilds unequal rows with every complete word and exact positions, keeping the activity artwork', () => {
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
    // A real grid: at least 10 columns, every word listed in the answer key.
    expect(grid[0].length).toBeGreaterThanOrEqual(12);
    for (const word of ['VIUVA', 'LAZARO', 'RESSURREICAO'])
      expect(String(activities[0].answer)).toMatch(
        new RegExp(
          `${word}: linha \\d+, coluna \\d+, na (horizontal|vertical|diagonal)\\.`,
        ),
      );
    expect(activities[1]).toBe(original.activities[1]);
    expect(repaired.printableAssets).toEqual(original.printableAssets);
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

  it('does not treat an uppercase sentence glued to the grid as a grid row', () => {
    const instruction =
      'Caça-palavras\nENCONTRE AS PALAVRAS\nJESUS\nABCDE\nFGHIJ\nPalavras: JESUS, VIDA';
    const repaired = repairMeditationWordSearch({
      activities: [{ instruction }],
    });
    const corrected = (repaired.activities as Array<{ instruction: string }>)[0]
      .instruction;
    expect(corrected).toContain('ENCONTRE AS PALAVRAS');
    expect(meditationWordSearchIssue(corrected)).toBeNull();
    // Without the fix the sentence counted as a row of a different length.
    expect(meditationWordSearchIssue(instruction)).toContain('VIDA');
  });

  it('keeps numeric asset ids and multiplication signs out of the grid detection', () => {
    const content = {
      activities: [
        {
          number: 2,
          instruction:
            'Caça-palavras\nJESUS\nABCDE\nFGHIJ\nPalavras: JESUS, VIDA',
        },
      ],
      printableAssets: [{ id: 2, url: 'support-art' }],
    };
    expect(repairMeditationWordSearch(content).printableAssets).toEqual(
      content.printableAssets,
    );
    expect(
      meditationWordSearchIssue('Caça-palavras\nA×BC\nD×EF\nG×HI'),
    ).toBeNull();
  });
});
