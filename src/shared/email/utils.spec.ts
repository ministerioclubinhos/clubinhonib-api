import {
  digitsOf,
  escapeHtml,
  formatBrazilianDateTime,
  formatEventDate,
  joinTextLines,
  safeUrl,
} from './utils';

describe('utils de e-mail', () => {
  describe('escapeHtml', () => {
    it('neutraliza as marcações que fechariam o HTML do e-mail', () => {
      expect(escapeHtml('<script>alert(1)</script>')).toBe(
        '&lt;script&gt;alert(1)&lt;/script&gt;',
      );
    });

    it('escapa aspas, que quebrariam um atributo', () => {
      expect(escapeHtml(`" onload='x'`)).toBe('&quot; onload=&#39;x&#39;');
    });

    it('escapa o & antes das demais entidades, sem duplicar', () => {
      expect(escapeHtml('a & <b>')).toBe('a &amp; &lt;b&gt;');
    });

    it('deixa texto comum intacto', () => {
      expect(escapeHtml('João da Silva')).toBe('João da Silva');
    });
  });

  describe('safeUrl', () => {
    it('aceita http e https', () => {
      expect(safeUrl('https://clubinhonib.com/a')).toBe(
        'https://clubinhonib.com/a',
      );
      expect(safeUrl('http://localhost:5173/a')).toBe(
        'http://localhost:5173/a',
      );
    });

    it('recusa esquema perigoso', () => {
      expect(safeUrl('javascript:alert(1)')).toBe('');
      expect(safeUrl('data:text/html,<script>')).toBe('');
    });

    it('recusa o que não é URL', () => {
      expect(safeUrl('não é url')).toBe('');
      expect(safeUrl('')).toBe('');
    });

    it('escapa a URL aceita, que vai para dentro de um atributo', () => {
      expect(safeUrl('https://site.com/?a=1&b="x"')).toContain('&amp;b=');
    });
  });

  describe('digitsOf', () => {
    it('mantém apenas os dígitos', () => {
      expect(digitsOf('+55 (11) 98888-7777')).toBe('5511988887777');
    });
  });

  describe('formatBrazilianDateTime', () => {
    it('formata no fuso de São Paulo', () => {
      // 12:00 UTC = 09:00 em São Paulo (UTC-3).
      const formatted = formatBrazilianDateTime(
        new Date('2026-03-10T12:00:00Z'),
      );

      expect(formatted).toContain('2026');
      expect(formatted).toContain('09:00');
    });
  });

  describe('formatEventDate', () => {
    it('lê a string da coluna date pelos componentes, sem passar por UTC', () => {
      // `new Date('2026-04-12')` seria interpretado como UTC e viraria dia 11
      // em qualquer fuso negativo, incluindo o do Brasil.
      expect(formatEventDate('2026-04-12')).toBe('12/04/2026');
      expect(formatEventDate('2026-01-01')).toBe('01/01/2026');
    });

    it('formata um Date no fuso de São Paulo', () => {
      expect(formatEventDate(new Date('2026-04-12T15:00:00Z'))).toBe(
        '12/04/2026',
      );
    });

    it('devolve o valor original quando não é data', () => {
      expect(formatEventDate('sem data')).toBe('sem data');
    });
  });

  describe('joinTextLines', () => {
    it('junta as linhas e colapsa os espaços em branco extras', () => {
      expect(joinTextLines(['  a  ', '', '', '', 'b  '])).toBe('a\n\nb');
    });
  });
});
