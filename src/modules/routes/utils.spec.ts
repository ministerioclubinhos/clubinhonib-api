import { toRoutePath } from './utils';

describe('toRoutePath', () => {
  it('junta o prefixo ao título em minúsculas', () => {
    expect(toRoutePath('Galeria de Fotos', 'pagina_')).toBe(
      'pagina_galeria_de_fotos',
    );
  });

  it('remove acento sem apagar a letra', () => {
    // O `path` entra na URL: acento aqui vira codificação percentual e
    // atrapalha quem compartilha o link.
    expect(toRoutePath('Meditação', '')).toBe('meditacao');
    expect(toRoutePath('Ação e Coração', '')).toBe('acao_e_coracao');
  });

  it('descarta pontuação', () => {
    expect(toRoutePath('Semana 1: materiais!', '')).toBe('semana_1_materiais');
  });

  it('colapsa espaços e sublinhados repetidos', () => {
    expect(toRoutePath('a   b', '')).toBe('a_b');
    expect(toRoutePath('a - b', '')).toBe('a_b');
  });

  it('título vazio devolve só o prefixo', () => {
    expect(toRoutePath('', 'doc_')).toBe('doc_');
  });
});
