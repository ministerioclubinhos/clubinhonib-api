import { OLDER_MEDITATION_REFERENCE_ONLY } from '../constants/older-meditation-layout.constants';
import {
  codeLegendPairs,
  decodeMeditationCode,
  meditationCodeMatches,
} from './meditation-code.utils';

describe('legenda do código da meditação dos maiores', () => {
  it('reconhece a legenda em uma linha, nos dois sentidos', () => {
    expect(codeLegendPairs('Código: A=1, B=2, C=3, D=4, E=5')).toEqual([
      ['A', '1'],
      ['B', '2'],
      ['C', '3'],
      ['D', '4'],
      ['E', '5'],
    ]);
    expect(
      codeLegendPairs('1 = E | 2 = A | 3 = I | 4 = O | 5 = U'),
    ).toHaveLength(5);
  });

  it('não confunde frase, frase cifrada ou poucos pares com legenda', () => {
    expect(codeLegendPairs('Use a tabela para decifrar a palavra.')).toBeNull();
    expect(
      codeLegendPairs('13-15-9-19-5-19 / 5 / 16-18-15-6-5-20-1-19'),
    ).toBeNull();
    expect(codeLegendPairs('A=1, B=2')).toBeNull();
  });
});

describe('subtítulo que é só referência bíblica', () => {
  it('reconhece referências e deixa nomes de relatos em paz', () => {
    expect(OLDER_MEDITATION_REFERENCE_ONLY.test('Lucas 16:19-31')).toBe(true);
    expect(OLDER_MEDITATION_REFERENCE_ONLY.test('Lucas 16.19-31.')).toBe(true);
    expect(
      OLDER_MEDITATION_REFERENCE_ONLY.test('João 11:1-44; Lucas 7:11-17'),
    ).toBe(true);
    expect(OLDER_MEDITATION_REFERENCE_ONLY.test('O rico e Lázaro')).toBe(false);
    expect(
      OLDER_MEDITATION_REFERENCE_ONLY.test(
        'Ressurreição de Lázaro / O filho da viúva',
      ),
    ).toBe(false);
  });
});

describe('conferência do código', () => {
  it('decifra pela própria tabela e confere com o gabarito', () => {
    const support =
      'Código: A=1, B=2, C=3, D=4, E=5, F=6, G=7, H=8, I=9, J=10, K=11, L=12, M=13, N=14, O=15, P=16, Q=17, R=18, S=19, T=20, U=21, V=22, W=23, X=24, Y=25, Z=26\n13-15-9-19-5-19 / 5 / 16-18-15-6-5-20-1-19';
    expect(decodeMeditationCode(support)).toBe('MOISES E PROFETAS');
    expect(meditationCodeMatches(support, 'Moisés e Profetas')).toBe(true);
  });

  it('pega o código gerado que não decifra a resposta', () => {
    const support =
      'Código: 1=O, 2=U, 3=V, 4=I, 5=R, 6=A, 7=P, 8=L, 9=B, 10=Í, 11=D, 12=C, 13=E, 14=J, 15=S, 16=T, 17=F.\nCódigo: 3-1-12-17-6-17 / 6 / 7-6-8-6-3-17-6 / 11-13 / 14-13-15-2-15.';
    expect(meditationCodeMatches(support, 'VOU A PALAVRA DE JESUS.')).toBe(
      false,
    );
  });

  it('não reprova quando não há tabela nem frase cifrada para conferir', () => {
    expect(
      meditationCodeMatches('Escreva a palavra secreta.', 'qualquer'),
    ).toBe(true);
  });
});
