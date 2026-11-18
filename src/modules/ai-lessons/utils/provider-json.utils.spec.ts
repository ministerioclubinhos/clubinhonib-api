import {
  parseProviderJsonObject,
  providerJsonDiagnostic,
} from './provider-json.utils';

describe('parseProviderJsonObject', () => {
  it('junta blocos de texto quando o JSON vem partido', () => {
    const blocks = ['{"assets": [{"id": "kit-01"', '}]}'];
    expect(
      parseProviderJsonObject([undefined, blocks.join(''), ...blocks]),
    ).toEqual({ assets: [{ id: 'kit-01' }] });
  });

  it('aceita JSON em cerca de código ou com texto em volta', () => {
    expect(parseProviderJsonObject(['```json\n{"a": 1}\n```'])).toEqual({
      a: 1,
    });
    expect(
      parseProviderJsonObject(['Aqui está o resultado:\n{"a": 1}\nPronto.']),
    ).toEqual({ a: 1 });
  });

  it('devolve null para texto que não tem um objeto JSON', () => {
    expect(
      parseProviderJsonObject(['[1, 2]', 'sem json', undefined]),
    ).toBeNull();
  });

  it('resume a resposta ilegível para o registro', () => {
    expect(providerJsonDiagnostic(['{"a":', ' 1'])).toBe(
      'blocos=2 tamanho=7 início="{"a": 1" fim="{"a": 1"',
    );
  });
});
