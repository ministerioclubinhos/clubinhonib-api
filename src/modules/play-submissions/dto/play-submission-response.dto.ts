import {
  PlatformType,
  UploadType,
} from 'src/shared/media/media-item/media-item.entity';
import { PlaySubmissionStatus } from '../enums/play-submission-status.enum';

export class PlaySubmitterDto {
  id: string;
  name: string;
  email: string;
  role: string;
}

export class PlaySubmissionResponseDto {
  id: string;
  title: string;
  description: string;
  uploadType: UploadType;
  platformType: PlatformType | null;
  url: string;
  originalName: string | null;
  size: number | null;
  thumbnailUrl: string | null;
  durationSeconds: number | null;
  status: PlaySubmissionStatus;
  rejectionReason: string | null;
  createdAt: string;
  reviewedAt: string | null;
  mediaItemId: string | null;
  /** Só na visão do administrador. */
  submitter?: PlaySubmitterDto | null;
}

export class PlaySubmissionCountsDto {
  pending: number;
  approved: number;
  rejected: number;
}

export class PlaySubmissionsPageDto {
  data: PlaySubmissionResponseDto[];
  total: number;
  page: number;
  limit: number;
  pageCount: number;
  counts: PlaySubmissionCountsDto;
}

/** Galeria que pode receber vídeos aprovados. */
export class PlayGalleryOptionDto {
  id: string;
  title: string;
  scope: string;
}
