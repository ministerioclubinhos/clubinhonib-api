import {
  documentFontSize,
  documentLineSpacing,
  documentLink,
  documentTableSpan,
} from './lessonDocument.utils';

describe('Lesson document export values', () => {
  it('converte pontos e pixels para o tamanho equivalente no Word', () => {
    expect(documentFontSize('24pt')).toBe(48);
    expect(documentFontSize('16px')).toBe(24);
    expect(documentFontSize('invalid')).toBeUndefined();
    expect(documentFontSize('-12pt')).toBeUndefined();
  });
  it('preserva espaçamento válido e rejeita valores inválidos', () => {
    expect(
      documentLineSpacing({ lineHeight: '2' }, { after: 120 }),
    ).toMatchObject({ line: 480, after: 120 });
    expect(
      documentLineSpacing({ lineHeight: 'invalid' }, { line: 276 }),
    ).toEqual({ line: 276 });
  });
  it('exporta somente links com protocolos suportados', () => {
    expect(documentLink('https://example.com')).toBe('https://example.com/');
    expect(documentLink('javascript:alert(1)')).toBeUndefined();
    expect(documentTableSpan(2)).toBe(2);
    expect(documentTableSpan(-1)).toBe(1);
  });
});
