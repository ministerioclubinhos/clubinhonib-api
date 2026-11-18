import { meditationWordSearchIssue } from './meditation-word-search.utils';

describe('meditation word search', () => {
  it('rejects the unequal rows from the reported PDF', () => {
    expect(
      meditationWordSearchIssue(
        'Caça-palavras\nPIXVIÚVAJ\nQÁZARONES\nRESSUREIÇÃO\nOCOIDZHLAM\nPalavras: VIÚVA, LÁZARO, RESSURREIÇÃO',
      ),
    ).toContain('tamanhos diferentes');
  });
  it('rejects a listed word absent from a rectangular grid', () => {
    expect(
      meditationWordSearchIssue(
        'Caça-palavras\nJESUS\nABCDE\nFGHIJ\nPalavras: JESUS, VIDA',
      ),
    ).toContain('VIDA');
  });
  it('finds horizontal, reversed, vertical and diagonal words with normalized accents', () => {
    expect(
      meditationWordSearchIssue(
        'Caça-palavras\nJESUS\nAVABC\nBAIDF\nCAADA\nVIDAX\nPalavras: JESUS, SUS, VIDA, JABC, JVID',
      ),
    ).toBeNull();
  });
  it('keeps visual puzzles and other activities outside text-grid validation', () => {
    expect(
      meditationWordSearchIssue('Resolva o caça-palavras ao lado.'),
    ).toBeNull();
    expect(meditationWordSearchIssue('Complete as frases.')).toBeNull();
  });
});
