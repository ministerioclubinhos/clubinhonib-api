import {
  ROUTE_DUPLICATE_ERROR_CODES,
  ROUTE_PATH_FALLBACK_BODY,
  ROUTE_PATH_MAX_LENGTH,
  ROUTE_PATH_SUFFIX_RESERVE,
} from './constants';

/**
 * Transforma um título em `path` de rota.
 *
 * Acentos são removidos, pontuação some e espaços viram `_`: o `path` é único
 * no banco e entra na URL, então precisa ser estável e sem surpresa de
 * codificação.
 */
export function toRoutePath(title: string, prefix: string): string {
  const corpo = title
    .toLowerCase()
    .normalize('NFD')
    // Remove os diacríticos que o NFD separou da letra.
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^\w\s]/gi, '')
    .replace(/\s+/g, '_')
    .replace(/_+/g, '_')
    .trim();

  return prefix + corpo;
}

/**
 * Base de `path` segura para gravar: nunca vazia e sempre com folga para o
 * sufixo de desempate dentro do tamanho da coluna.
 *
 * Títulos comuns saem idênticos a `toRoutePath`; só mudam os casos que antes
 * quebravam a gravação (título enorme) ou geravam um `path` sem corpo (título
 * só com emoji ou pontuação).
 */
export function toBoundedRoutePath(title: string, prefix: string): string {
  const corpo = toRoutePath(title, '').replace(/^_+|_+$/g, '');
  const limite = Math.max(
    1,
    ROUTE_PATH_MAX_LENGTH - ROUTE_PATH_SUFFIX_RESERVE - prefix.length,
  );
  const recortado = corpo.slice(0, limite).replace(/_+$/g, '');
  const original = toRoutePath(title, prefix);
  // Preserva o resultado histórico sempre que ele já é válido.
  if (
    corpo &&
    original.length <= ROUTE_PATH_MAX_LENGTH - ROUTE_PATH_SUFFIX_RESERVE
  )
    return original;
  return prefix + (recortado || ROUTE_PATH_FALLBACK_BODY);
}

/** Erro de unicidade devolvido pelo banco ao gravar um `path` já usado. */
export function isDuplicateRouteError(error: unknown): boolean {
  const codes = [error, (error as { driverError?: unknown })?.driverError]
    .map((item) => (item as { code?: unknown } | null | undefined)?.code)
    .filter((code): code is string => typeof code === 'string');
  return codes.some((code) => ROUTE_DUPLICATE_ERROR_CODES.includes(code));
}
