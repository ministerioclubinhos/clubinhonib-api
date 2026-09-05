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
