/** Uma mídia da ideia compartilhada, no recorte que a tela usa. */
export class IdeasSectionMediaResponseDto {
  id: string;
  title: string | null;
  description: string | null;
  uploadType: string;
  mediaType: string;
  isLocalFile: boolean;
  url: string;
  platformType: string | null;
  originalName: string | null;
  size: number | null;
}

/** Contrato de resposta de `/ideas-sections`. */
export class IdeasSectionResponseDto {
  id: string;
  title: string;
  description: string;
  public: boolean;
  /** Página onde a ideia foi publicada; `null` enquanto está pendente. */
  pageId: string | null;
  medias: IdeasSectionMediaResponseDto[];
  createdAt: string;
  updatedAt: string;
}
