import { InternalAiProviderSettings } from 'src/modules/ai-lessons/types/ai-provider-settings.types';
import { MediaItemEntity } from 'src/shared/media/media-item/media-item.entity';
import {
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
export interface IdeaAiTextResult {
  title: string | null;
  description: string | null;
  guard: IdeaAiGuard;
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
  artifact?: IdeaAiArtifact;
  editable?: IdeaAiArtifact;
}
export interface IdeaAiProcessContext {
  settings: InternalAiProviderSettings;
  source: MediaItemEntity;
  imageIndex: number;
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
}

export type IdeaImageFormat = 'jpeg' | 'png' | 'webp' | 'gif';
export interface PreparedIdeaImage extends IdeaAiAttachment {
  format: IdeaImageFormat;
  animated: boolean;
}
export interface RenderedIdeaDocument {
  artifact: IdeaAiArtifact;
  editable: IdeaAiArtifact;
}
export type IdeaPdfParser = (data: Buffer) => Promise<ParsedIdeaPdf>;

export interface StagedIdeaAiMedia {
  result: IdeaAiMediaResult;
  url: string | null;
  editableUrl: string | null;
}
