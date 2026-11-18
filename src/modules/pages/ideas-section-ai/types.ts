import { InternalAiProviderSettings } from 'src/modules/ai-lessons/types/ai-provider-settings.types';
import {
  MediaItemEntity,
  MediaType,
} from 'src/shared/media/media-item/media-item.entity';
import {
  IdeaAiErrorCode,
  IdeaAiMediaStatus,
  IdeaAiSkipReason,
} from './enums/ideas-section-ai.enums';
import { UpdateIdeasSectionDto } from '../ideas-section/dto/update-ideas-section.dto';
export interface IdeaAiPublicationPreparation {
  dto: UpdateIdeasSectionDto;
  existingMedia: MediaItemEntity[];
}
export interface IdeaAiAttachment {
  data: Buffer;
  mimeType: string;
  name: string;
}
export interface IdeaAiJsonRequest {
  instructions: string;
  data: unknown;
  attachments?: IdeaAiAttachment[];
  schema: Record<string, unknown>;
}
export interface IdeaAiGuard {
  approved: boolean;
  violations: string[];
}
/** Text guard with a verdict per field, so one bad field keeps the other. */
export interface IdeaAiTextGuard extends IdeaAiGuard {
  fields?: {
    title: IdeaAiGuard;
    description: IdeaAiGuard;
  };
}
export interface IdeaAiTextResult {
  title: string | null;
  description: string | null;
  guard: IdeaAiTextGuard;
}
export interface IdeaAiArtifact {
  buffer: Buffer;
  name: string;
  mimeType: string;
}
export interface IdeaAiMediaResult {
  sourceMediaId: string;
  status: IdeaAiMediaStatus;
  skipReason?: IdeaAiSkipReason;
  guard?: IdeaAiGuard;
  errorCode?: IdeaAiErrorCode;
  artifact?: IdeaAiArtifact;
  editable?: IdeaAiArtifact;
  /** Conteúdo do documento melhorado no formato do editor, para edição manual. */
  editableDocument?: IdeaTiptapDocument;
}
/** Um arquivo da ideia, visto pelas outras etapas como contexto. */
export interface IdeaAiMaterialContext {
  name: string;
  type: MediaType;
  /** Texto extraído (truncado); null quando o arquivo não tem texto ou não foi lido. */
  text: string | null;
}
/** PDF já convertido e lido, reaproveitado pela etapa do documento. */
export interface IdeaAiPreparedDocument {
  pdf: Buffer;
  text: string;
  pages: number;
  images: number;
}
/** A ideia inteira: o que cada etapa da IA enxerga além do seu próprio item. */
export interface IdeaAiIdeaContext {
  title: string;
  description: string;
  materials: IdeaAiMaterialContext[];
  prepared: Map<string, IdeaAiPreparedDocument>;
}
export interface IdeaAiProcessContext {
  settings: InternalAiProviderSettings;
  idea: IdeaAiIdeaContext;
  source: MediaItemEntity;
  imageIndex: number;
  /** Admin guidance for this attempt (documents only; images stay literal). */
  instructions: string | null;
}
export interface IdeaAiProviderResponse {
  output?: Array<{ content?: Array<{ type?: string; text?: string }> }>;
  incomplete_details?: unknown;
  candidates?: Array<{
    content?: {
      parts?: Array<{
        text?: string;
        inlineData?: { data: string; mimeType: string };
      }>;
    };
  }>;
  data?: Array<{ b64_json?: string }>;
}
export interface ParsedIdeaPdf {
  text: string;
  numpages: number;
  /** Imagens embutidas grandes o bastante para fazer parte do conteúdo. */
  images: number;
}
export type IdeaImageFormat = 'jpeg' | 'png' | 'webp' | 'gif';
export interface PreparedIdeaImage extends IdeaAiAttachment {
  format: IdeaImageFormat;
  animated: boolean;
}
export interface RenderedIdeaDocument {
  artifact: IdeaAiArtifact;
  editable: IdeaAiArtifact;
  document: IdeaTiptapDocument;
}

/** Marca de texto do editor de documentos das ideias (negrito, cor, link…). */
export interface IdeaTiptapMark {
  type: string;
  attrs?: Record<string, unknown>;
}
/** Nó do documento do editor das ideias (formato JSON do TipTap). */
export interface IdeaTiptapNode {
  type: string;
  attrs?: Record<string, unknown>;
  content?: IdeaTiptapNode[];
  text?: string;
  marks?: IdeaTiptapMark[];
}
export interface IdeaTiptapDocument {
  type: 'doc';
  content: IdeaTiptapNode[];
}
export type IdeaPdfParser = (
  data: Buffer,
) => Promise<Omit<ParsedIdeaPdf, 'images'>>;

export interface StagedIdeaAiMedia {
  result: IdeaAiMediaResult;
  url: string | null;
  editableUrl: string | null;
}

export interface IdeaAiProgress {
  done: number;
  total: number;
}

/** What a new attempt redoes and which result fills in the rest. */
export interface IdeaAiAttemptTarget {
  includeText: boolean;
  /** null = every snapshot media. */
  mediaIds: string[] | null;
  baseEnhancementId: string | null;
}
