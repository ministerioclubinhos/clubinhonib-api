import { PhotoCommentStatus } from '../types';
import {
  PlatformType,
  MediaType,
  UploadType,
} from 'src/shared/media/media-item/media-item.entity';

export class PhotoCommentResponseDto {
  id: string;
  mediaId: string;
  text: string;
  authorName: string;
  createdAt: string;
}

export class OwnPhotoCommentResponseDto extends PhotoCommentResponseDto {
  status: PhotoCommentStatus;
  moderationReason: string | null;
  version: number;
}

export class AdminPhotoCommentResponseDto extends OwnPhotoCommentResponseDto {
  mediaType: MediaType;
  authorId: string;
  photoUrl: string;
  photoUploadType: UploadType;
  photoPlatformType: PlatformType | null;
  photoTitle: string;
  sectionId: string;
  sectionCaption: string;
  reviewedAt: string | null;
  moderatedByName: string | null;
}

export class PhotoCommentDeletedDto {
  message: string;
}
