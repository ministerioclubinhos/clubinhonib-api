import { internalNoticeEmail } from './internal-notice';

const base = {
  subject: 'Assunto do aviso',
  title: 'Título do aviso',
  intro: 'Alguma coisa aconteceu no site.',
  detailsHeading: 'Detalhes',
};

describe('internalNoticeEmail', () => {
  it('monta HTML e texto a partir das mesmas linhas', () => {
    const { html, text } = internalNoticeEmail({
      ...base,
      rows: [
        { label: 'Nome', value: 'Ana' },
        { label: 'E-mail', value: 'ana@exemplo.com', as: 'email' },
      ],
    });

    expect(html).toContain('Ana');
    expect(html).toContain('mailto:ana@exemplo.com');
    expect(text).toContain('Nome: Ana');
    expect(text).toContain('E-mail: ana@exemplo.com');
  });

  it('omite linha sem valor, sem precisar de condicional no template', () => {
    const { html, text } = internalNoticeEmail({
      ...base,
      rows: [
        { label: 'Nome', value: 'Ana' },
        { label: 'Autor', value: '' },
        { label: 'Telefone', value: '   ' },
      ],
    });

    expect(html).not.toContain('Autor');
    expect(html).not.toContain('Telefone');
    expect(text).not.toContain('Autor:');
  });

  it('aceita linha ausente na lista', () => {
    const { text } = internalNoticeEmail({
      ...base,
      rows: [{ label: 'Nome', value: 'Ana' }, null, undefined, false],
    });

    expect(text).toContain('Nome: Ana');
  });

  it('inclui os blocos de texto que têm conteúdo', () => {
    const { html, text } = internalNoticeEmail({
      ...base,
      rows: [{ label: 'Nome', value: 'Ana' }],
      sections: [
        { heading: 'Mensagem', text: 'Olá, tudo bem?' },
        { heading: 'Descrição', text: '' },
      ],
    });

    expect(html).toContain('Olá, tudo bem?');
    expect(html).not.toContain('Descrição');
    expect(text).toContain('Mensagem:');
    expect(text).toContain('Olá, tudo bem?');
  });

  it('mantém a mesma ordem de campos no HTML e no texto', () => {
    // As duas versões divergiam quando eram escritas separadamente.
    const rows = [
      { label: 'Primeiro', value: '1' },
      { label: 'Segundo', value: '2' },
      { label: 'Terceiro', value: '3' },
    ];
    const { html, text } = internalNoticeEmail({ ...base, rows });

    const htmlOrder = ['Primeiro', 'Segundo', 'Terceiro'].map((label) =>
      html.indexOf(label),
    );
    const textOrder = ['Primeiro', 'Segundo', 'Terceiro'].map((label) =>
      text.indexOf(label),
    );

    expect(htmlOrder).toEqual([...htmlOrder].sort((a, b) => a - b));
    expect(textOrder).toEqual([...textOrder].sort((a, b) => a - b));
  });

  it('escapa o conteúdo das linhas e dos blocos', () => {
    const { html } = internalNoticeEmail({
      ...base,
      rows: [{ label: 'Nome', value: '<script>alert(1)</script>' }],
      sections: [{ heading: 'Mensagem', text: '<b>oi</b>' }],
    });

    expect(html).not.toContain('<script>');
    expect(html).not.toContain('<b>oi</b>');
    expect(html).toContain('&lt;script&gt;');
  });

  it('usa o assunto e o título informados', () => {
    const { subject, html } = internalNoticeEmail({
      ...base,
      rows: [{ label: 'Nome', value: 'Ana' }],
    });

    expect(subject).toBe('Assunto do aviso');
    expect(html).toContain('Título do aviso');
  });
});
