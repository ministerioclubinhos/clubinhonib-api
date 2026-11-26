/** Quais vídeos de uma galeria aparecem no Clubinho Play. */
export enum PlayScope {
  /** Nenhum: a galeria não aparece no Play (padrão). */
  NONE = 'none',
  /** A galeria inteira, inclusive vídeos adicionados depois. */
  ALL = 'all',
  /** Só os vídeos marcados pelo administrador. */
  SELECTED = 'selected',
}
