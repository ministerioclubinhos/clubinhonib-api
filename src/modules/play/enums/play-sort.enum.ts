/** Ordenação da listagem do Play. */
export enum PlaySort {
  /** Curadoria do admin: destaque, posição, criação. */
  CURATED = 'curated',
  RECENT = 'recent',
  POPULAR = 'popular',
  TITLE = 'title',
  /** Último assistido primeiro (continuar assistindo). */
  CONTINUE = 'continue',
}

/** Tipo de fileira da home do Play. */
export enum PlaySectionKind {
  FEATURED = 'featured',
  CONTINUE = 'continue',
  LATEST = 'latest',
  POPULAR = 'popular',
  CATEGORY = 'category',
  GALLERY = 'gallery',
}
