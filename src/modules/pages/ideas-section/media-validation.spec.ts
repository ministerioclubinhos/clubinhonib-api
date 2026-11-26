import { AppValidationException } from 'src/shared/exceptions';
import {
  MediaItemEntity,
  MediaType,
  PlatformType,
  UploadType,
} from 'src/shared/media/media-item/media-item.entity';
import { IdeasSectionMediaType } from './entities/ideas-section-media-type.enum';
import { validateIdeasShareMedia } from './media-validation';
import { IdeasSectionMediaItemDto } from './dto/ideas-section-media-item.dto';
import { UploadedFilesDict } from './types';

const uploadFile = (
  fieldname: string,
  originalname: string,
  mimetype: string,
  size = 120,
): Express.Multer.File =>
  ({ fieldname, originalname, mimetype, size }) as Express.Multer.File;

describe('validateIdeasShareMedia', () => {
  it('accepts an uploaded PDF and a YouTube video', () => {
    const medias = [
      {
        mediaType: IdeasSectionMediaType.DOCUMENT,
        uploadType: UploadType.UPLOAD,
        isLocalFile: true,
        fieldKey: 'doc',
        originalName: 'guia.pdf',
      },
      {
        mediaType: IdeasSectionMediaType.VIDEO,
        uploadType: UploadType.LINK,
        isLocalFile: false,
        platformType: PlatformType.YOUTUBE,
        url: 'https://youtu.be/abcdefghijk',
      },
    ] as IdeasSectionMediaItemDto[];
    const files: UploadedFilesDict = {
      doc: uploadFile('doc', 'guia.pdf', 'application/pdf'),
    };
    expect(() => validateIdeasShareMedia(medias, files)).not.toThrow();
  });

  it('rejects document links before storage', () => {
    expect(() =>
      validateIdeasShareMedia(
        [
          {
            mediaType: IdeasSectionMediaType.DOCUMENT,
            uploadType: UploadType.LINK,
            isLocalFile: false,
            url: 'https://example.com/a.pdf',
          },
        ] as IdeasSectionMediaItemDto[],
        {},
      ),
    ).toThrow(AppValidationException);
  });

  it('rejects non-YouTube video links and mismatched file formats', () => {
    expect(() =>
      validateIdeasShareMedia(
        [
          {
            mediaType: IdeasSectionMediaType.VIDEO,
            uploadType: UploadType.LINK,
            isLocalFile: false,
            platformType: PlatformType.GOOGLE_DRIVE,
            url: 'https://drive.google.com/file',
          },
        ] as IdeasSectionMediaItemDto[],
        {},
      ),
    ).toThrow(AppValidationException);
    const files: UploadedFilesDict = {
      photo: uploadFile('photo', 'foto.gif', 'image/jpeg'),
    };
    expect(() =>
      validateIdeasShareMedia(
        [
          {
            mediaType: IdeasSectionMediaType.IMAGE,
            uploadType: UploadType.UPLOAD,
            isLocalFile: true,
            fieldKey: 'photo',
          },
        ] as IdeasSectionMediaItemDto[],
        files,
      ),
    ).toThrow(AppValidationException);
  });

  it('preserves an unchanged legacy link, but rejects changing it to a non-YouTube link', () => {
    const existing = Object.assign(new MediaItemEntity(), {
      id: 'legacy-video',
      mediaType: MediaType.VIDEO,
      uploadType: UploadType.LINK,
      isLocalFile: false,
      platformType: PlatformType.GOOGLE_DRIVE,
      url: 'https://drive.google.com/legacy',
    });
    const legacyInput = {
      id: existing.id,
      mediaType: IdeasSectionMediaType.VIDEO,
      uploadType: UploadType.LINK,
      isLocalFile: false,
      platformType: PlatformType.GOOGLE_DRIVE,
      url: existing.url,
    } as IdeasSectionMediaItemDto;
    expect(() =>
      validateIdeasShareMedia([legacyInput], {}, [existing], false),
    ).not.toThrow();
    expect(() =>
      validateIdeasShareMedia(
        [{ ...legacyInput, url: 'https://drive.google.com/changed' }],
        {},
        [existing],
        false,
      ),
    ).toThrow(AppValidationException);
  });
});

it('rejects inconsistent upload/local-file declarations before storage', () => {
  expect(() =>
    validateIdeasShareMedia(
      [
        {
          mediaType: IdeasSectionMediaType.DOCUMENT,
          uploadType: UploadType.UPLOAD,
          isLocalFile: false,
          fieldKey: 'doc',
        },
      ],
      { doc: uploadFile('doc', 'guide.pdf', 'application/pdf') },
    ),
  ).toThrow(AppValidationException);
  expect(() =>
    validateIdeasShareMedia(
      [
        {
          mediaType: IdeasSectionMediaType.VIDEO,
          uploadType: UploadType.LINK,
          isLocalFile: true,
          platformType: PlatformType.YOUTUBE,
          url: 'https://youtu.be/abcdefghijk',
        },
      ],
      {},
    ),
  ).toThrow(AppValidationException);
});
