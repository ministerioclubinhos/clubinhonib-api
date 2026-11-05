/** Uma foto da seção, no recorte que a tela usa. */
export class ImageSectionMediaResponseDto {
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

export class ImageSectionAuthorDto {
  name: string;
}

/** Contrato de resposta de `/image-sections`. */
export class ImageSectionResponseDto {
  id: string;
  caption: string;
  description: string;
  /** Visível no feed do clubinho. */
  public: boolean;
  /** Página do feed onde entrou; `null` enquanto aguarda aprovação. */
  pageId: string | null;
  author: ImageSectionAuthorDto | null;
  mediaItems: ImageSectionMediaResponseDto[];
  createdAt: string;
  updatedAt: string;
}
