import { PlatformType } from 'src/shared/media/media-item/media-item.entity';
import { parseYoutubeVideoId } from 'src/shared/media/youtube-url';
import { PlaySubmissionEntity } from './entities/play-submission.entity';
import { PlaySubmissionResponseDto } from './dto/play-submission-response.dto';

const iso = (value: Date | string | null): string | null =>
  value === null
    ? null
    : value instanceof Date
      ? value.toISOString()
      : String(value);

/** Miniatura enviada, ou a do próprio YouTube. */
export function resolveSubmissionThumbnail(
  submission: PlaySubmissionEntity,
): string | null {
  if (submission.thumbnailUrl) return submission.thumbnailUrl;
  if (submission.platformType === PlatformType.YOUTUBE) {
    const id = parseYoutubeVideoId(submission.url);
    if (id) return `https://img.youtube.com/vi/${id}/hqdefault.jpg`;
  }
  return null;
}

export function toSubmissionResponse(
  submission: PlaySubmissionEntity,
  withSubmitter = false,
): PlaySubmissionResponseDto {
  const user = submission.submittedBy;
  return {
    id: submission.id,
    title: submission.title,
    description: submission.description,
    uploadType: submission.uploadType,
    platformType: submission.platformType,
    url: submission.url,
    originalName: submission.originalName,
    size: submission.size,
    thumbnailUrl: resolveSubmissionThumbnail(submission),
    durationSeconds: submission.durationSeconds,
    status: submission.status,
    rejectionReason: submission.rejectionReason,
    createdAt: iso(submission.createdAt) ?? '',
    reviewedAt: iso(submission.reviewedAt),
    mediaItemId: submission.mediaItemId,
    ...(withSubmitter
      ? {
          submitter: user
            ? {
                id: user.id,
                name: user.name,
                email: user.email,
                role: user.role,
              }
            : null,
        }
      : {}),
  };
}
