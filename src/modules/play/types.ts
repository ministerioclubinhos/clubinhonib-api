import { PlayScope } from './enums/play-scope.enum';

/** Atributos de Play que o administrador define em cada vídeo do payload. */
export interface PlayVideoFlags {
  inPlay?: boolean;
  featured?: boolean;
  position?: number;
  /** Campo multipart com a miniatura enviada. */
  thumbnailField?: string;
  durationSeconds?: number;
}

/** Uma linha a gravar em `play_video_entries`. */
export interface PlayEntryInput {
  mediaItemId: string;
  featured: boolean;
  position: number | null;
  thumbnailUrl: string | null;
  durationSeconds: number | null;
}

/** Envia um arquivo ao S3 e devolve a URL. */
export type PlayUploadFn = (file: Express.Multer.File) => Promise<string>;

/** Arquivos recebidos, indexados pelo campo multipart. */
export type PlayFilesDict = Record<string, Express.Multer.File>;

/** Linha crua da consulta de vídeos do Play. */
export interface PlayVideoRow {
  id: string;
  title: string;
  description: string;
  uploadType: string;
  platformType: string | null;
  url: string;
  isLocalFile: number | boolean;
  originalName: string | null;
  size: number | null;
  galleryId: string;
  galleryTitle: string;
  featured: number | boolean | null;
  createdAt: Date | string;
  thumbnailUrl: string | null;
  durationSeconds: number | null;
  categoryId: string | null;
  categoryName: string | null;
  viewCount: number | string;
  favorite: number | boolean;
  progressPosition: number | null;
  progressDuration: number | null;
  progressCompleted: number | boolean | null;
}

/** Filtros internos da consulta de vídeos. */
export interface PlayVideoFilters {
  userId: string;
  page?: number;
  limit?: number;
  search?: string;
  galleryId?: string;
  categoryId?: string;
  favorites?: boolean;
  inProgress?: boolean;
  featured?: boolean;
  sort?: import('./enums/play-sort.enum').PlaySort;
  excludeId?: string;
  /** Prioriza vídeos desta galeria/categoria (relacionados). */
  relatedToGalleryId?: string;
  relatedToCategoryId?: string | null;
}

export interface PlayConfigState {
  scope: PlayScope;
  categoryId: string | null;
}
