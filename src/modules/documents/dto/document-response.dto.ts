/** O arquivo do documento, no recorte que a tela usa. */
export class DocumentMediaResponseDto {
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

/** Contrato de resposta de `/documents`. */
export class DocumentResponseDto {
  id: string;
  name: string;
  description: string | null;
  /** `null` quando o documento ficou sem arquivo. */
  media: DocumentMediaResponseDto | null;
  createdAt: string;
  updatedAt: string;
}
