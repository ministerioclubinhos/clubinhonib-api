import { ROUTE_PATH_MAX_LENGTH, ROUTE_PATH_SUFFIX_RESERVE } from './constants';
import {
  isDuplicateRouteError,
  toBoundedRoutePath,
  toRoutePath,
} from './utils';

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

describe('toBoundedRoutePath', () => {
  it('mantém o resultado histórico de títulos comuns', () => {
    for (const title of [
      'Semana 12 — O Bom Pastor',
      'Material Especial (Semana 3) — Páscoa',
      'Galeria de Fotos',
    ])
      expect(toBoundedRoutePath(title, 'materiais_semanal_')).toBe(
        toRoutePath(title, 'materiais_semanal_'),
      );
  });

  it('nunca devolve um path sem corpo', () => {
    // Título só com emoji ou pontuação não deixa nenhum caractere aproveitável.
    expect(toBoundedRoutePath('🎉🎉', 'materiais_semanal_')).toBe(
      'materiais_semanal_pagina',
    );
    expect(toBoundedRoutePath('— !!! —', '')).toBe('pagina');
    expect(toBoundedRoutePath('', '')).toBe('pagina');
  });

  it('recorta títulos enormes deixando folga para o sufixo de desempate', () => {
    const path = toBoundedRoutePath('tema '.repeat(200), 'materiais_semanal_');

    expect(path.length).toBeLessThanOrEqual(
      ROUTE_PATH_MAX_LENGTH - ROUTE_PATH_SUFFIX_RESERVE,
    );
    expect(path.startsWith('materiais_semanal_tema_tema')).toBe(true);
    expect(path.endsWith('_')).toBe(false);
  });
});

describe('isDuplicateRouteError', () => {
  it('reconhece a violação de unicidade do MySQL, inclusive embrulhada pelo TypeORM', () => {
    expect(isDuplicateRouteError({ code: 'ER_DUP_ENTRY' })).toBe(true);
    expect(
      isDuplicateRouteError({ driverError: { code: 'ER_DUP_ENTRY' } }),
    ).toBe(true);
  });

  it('não confunde outros erros com colisão de path', () => {
    expect(isDuplicateRouteError(new Error('db down'))).toBe(false);
    expect(isDuplicateRouteError({ code: 'ER_LOCK_DEADLOCK' })).toBe(false);
    expect(isDuplicateRouteError(null)).toBe(false);
  });
});
