import {
  button,
  dataTable,
  heading,
  linkFallback,
  note,
  paragraph,
  quoteBlock,
} from './blocks';
import { renderEmailLayout } from './layout';

/** Classes que o bloco de tema escuro sabe repintar. */
const THEMED = [
  'text-primary',
  'text-muted',
  'border-color',
  'surface-bg',
  'card-bg',
  'body-bg',
];

/** Elementos que definem cor ou fundo inline. */
const coloredTags = (html: string): string[] =>
  html.match(
    /<[a-z]+[^>]*style="[^"]*(?:^|[^-])(?:color|background-color):[^"]*"[^>]*>/g,
  ) ?? [];

const isThemed = (tag: string): boolean =>
  THEMED.some((className) => tag.includes(className));

/**
 * A faixa do cabeçalho e o botão são escuros ou saturados nos dois temas, com
 * texto branco: não entram no bloco escuro de propósito.
 */
const isIntentionallyFixed = (tag: string): boolean =>
  tag.includes('header-padding') ||
  tag.includes('background-color: #EB1E26') ||
  tag.includes('brand-mobile') ||
  tag.includes('title-mobile') ||
  tag.includes('<a href=');

describe('tema escuro', () => {
  const body = [
    paragraph('Um parágrafo.'),
    heading('Um título'),
    dataTable([
      { label: 'Nome', value: 'Ana' },
      { label: 'E-mail', value: 'ana@exemplo.com', as: 'email' },
    ]),
    quoteBlock('Uma citação.'),
    button('Ação', 'https://clubinhonib.com'),
    linkFallback('https://clubinhonib.com'),
    note('Uma observação.'),
  ].join('\n');

  const html = renderEmailLayout({
    title: 'Título',
    recipientName: 'Ana',
    body,
  });

  it('todo elemento colorido é repintado ou é fixo de propósito', () => {
    // Um elemento com cor inline e sem classe fica com a cor clara sobre o
    // fundo escuro — foi assim que a URL do link virou azul sobre azul.
    const unthemed = coloredTags(html)
      .filter((tag) => !isThemed(tag))
      .filter((tag) => !isIntentionallyFixed(tag));

    expect(unthemed).toEqual([]);
  });

  it('declara as duas formas de tema escuro que os clientes usam', () => {
    expect(html).toContain('@media (prefers-color-scheme: dark)');
    expect(html).toContain('[data-ogsc]');
    expect(html).toContain('name="color-scheme"');
  });

  it('repinta fundo, texto e separador', () => {
    for (const className of THEMED) {
      expect(html).toContain(`.${className} {`);
    }
  });

  it('o cabeçalho é escuro com texto branco nos dois temas', () => {
    // Antes era faixa verde com texto azul: quando o cliente invertia por
    // conta própria, sobrava texto claro sobre verde claro.
    expect(html).toContain(
      'background-color: #2F3290; border-bottom: 4px solid',
    );
    expect(html).toContain('color: #FFFFFF');
  });
});
