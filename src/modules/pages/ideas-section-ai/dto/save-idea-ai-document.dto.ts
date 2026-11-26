import { IsObject, IsUUID } from 'class-validator';
import type { IdeaTiptapDocument } from '../types';

/**
 * Documento editado à mão. A estrutura é conferida a fundo no serviço
 * (`validateIdeaTiptapDocument`): aqui só se garante que é um objeto.
 */
export class SaveIdeaAiDocumentDto {
  /** Tentativa que estava na tela; outra no lugar pede nova conferência (409). */
  @IsUUID() enhancementId: string;
  @IsObject() document: IdeaTiptapDocument;
}
