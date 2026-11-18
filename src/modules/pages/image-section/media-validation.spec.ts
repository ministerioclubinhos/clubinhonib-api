import { parseSectionPayload } from './utils';
import { CreateImageSectionDto } from './dto/create-image-section.dto';
import { MediaItemDto } from 'src/shared/share-dto/media-item-dto';
import {
  MediaItemEntity,
  MediaType,
  UploadType,
} from 'src/shared/media/media-item/media-item.entity';
import { validateClubinhoMedia } from './media-validation';
import {
  CLUBINHO_MAX_VIDEO_BYTES,
  CLUBINHO_MAX_IMAGE_BYTES,
} from './constants';

const photo: MediaItemDto = {
  mediaType: MediaType.IMAGE,
  uploadType: UploadType.LINK,
  isLocalFile: false,
  url: 'https://example.com/photo.png',
};
const video: MediaItemDto = {
  mediaType: MediaType.VIDEO,
  uploadType: UploadType.UPLOAD,
  isLocalFile: true,
  fieldKey: 'video',
  originalName: 'video.mp4',
};
const mp4 = (): Express.Multer.File =>
  ({
    fieldname: 'video',
    originalname: 'video.mp4',
    mimetype: 'video/mp4',
    size: 16,
    buffer: Buffer.from([
      0, 0, 0, 16, 102, 116, 121, 112, 105, 115, 111, 109, 0, 0, 0, 0,
    ]),
  }) as Express.Multer.File;

describe('Clubinho photo/video selection', () => {
  it('accepts multiple photos and a single uploaded video', () => {
    expect(() => validateClubinhoMedia([photo, photo], {})).not.toThrow();
    expect(() =>
      validateClubinhoMedia([video], { video: mp4() }),
    ).not.toThrow();
  });
  it.each(
    [
      [],
      [photo, video],
      [video, video],
      [{ ...photo, mediaType: MediaType.DOCUMENT }],
      Array.from({ length: 21 }, () => photo),
    ].map((items) => ({ items })),
  )('rejects invalid composition before uploading', ({ items }) => {
    expect(() => validateClubinhoMedia(items, {})).toThrow();
  });
  it.each([
    { mimetype: 'image/jpeg' },
    { originalname: 'video.exe' },
    { size: 0 },
    { size: CLUBINHO_MAX_VIDEO_BYTES + 1 },
    { buffer: Buffer.from('this is not a video') },
  ])('rejects inconsistent or oversized files: %j', (changes) => {
    expect(() =>
      validateClubinhoMedia([video], { video: { ...mp4(), ...changes } }),
    ).toThrow();
  });
  it('checks the image limit and signature', () => {
    const item = { ...video, mediaType: MediaType.IMAGE };
    const file = {
      ...mp4(),
      mimetype: 'image/png',
      originalname: 'photo.png',
      buffer: Buffer.from([137, 80, 78, 71, 13, 10, 26, 10, 0, 0, 0, 0]),
    };
    expect(() => validateClubinhoMedia([item], { video: file })).not.toThrow();
    expect(() =>
      validateClubinhoMedia([item], {
        video: { ...file, size: CLUBINHO_MAX_IMAGE_BYTES + 1 },
      }),
    ).toThrow();
  });
  it('requires uploads for new video and retains an existing video without a new file', () => {
    expect(() => validateClubinhoMedia([video], {})).toThrow();
    expect(() =>
      validateClubinhoMedia(
        [
          {
            ...video,
            uploadType: UploadType.LINK,
            isLocalFile: false,
            url: 'https://example.com/video.mp4',
          },
        ],
        {},
      ),
    ).toThrow();
    const stored = Object.assign(new MediaItemEntity(), {
      id: 'existing',
      isLocalFile: true,
      mediaType: MediaType.VIDEO,
    });
    expect(() =>
      validateClubinhoMedia([{ ...video, id: 'existing' }], {}, [stored]),
    ).not.toThrow();
    expect(() =>
      validateClubinhoMedia([{ ...video, id: 'foreign' }], {}, [stored]),
    ).toThrow();
    expect(() =>
      validateClubinhoMedia(
        [{ ...video, id: 'existing', mediaType: MediaType.IMAGE }],
        {},
        [stored],
      ),
    ).toThrow();
  });
  it('rejects missing/extra files and unsafe photo URLs', () => {
    expect(() => validateClubinhoMedia([photo], { video: mp4() })).toThrow();
    expect(() =>
      validateClubinhoMedia([{ ...photo, url: 'javascript:alert(1)' }], {}),
    ).toThrow();
    expect(() =>
      validateClubinhoMedia([{ ...photo, url: 'invalid' }], {}),
    ).toThrow();
  });
  it('rejects client-supplied authorship and visibility', async () => {
    const payload = {
      caption: 'Encontro',
      description: 'Descrição',
      mediaItems: [photo],
    };
    await expect(
      parseSectionPayload(
        CreateImageSectionDto,
        JSON.stringify({ ...payload, author: { name: 'Spoofed' } }),
      ),
    ).rejects.toThrow();
    await expect(
      parseSectionPayload(
        CreateImageSectionDto,
        JSON.stringify({ ...payload, public: true }),
      ),
    ).rejects.toThrow();
    await expect(
      parseSectionPayload(
        CreateImageSectionDto,
        JSON.stringify({ ...payload, caption: '  ' }),
      ),
    ).rejects.toThrow();
  });
  it.each([
    {
      mime: 'image/jpeg',
      name: 'photo.jpg',
      bytes: [255, 216, 255, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    },
    {
      mime: 'image/gif',
      name: 'photo.gif',
      bytes: Array.from(Buffer.from('GIF89a000000')),
    },
    {
      mime: 'image/webp',
      name: 'photo.webp',
      bytes: Array.from(Buffer.from('RIFF0000WEBP')),
    },
    {
      mime: 'video/webm',
      name: 'clip.webm',
      bytes: [26, 69, 223, 163, 0, 0, 0, 0, 0, 0, 0, 0],
    },
  ])('validates $mime signatures', ({ mime, name, bytes }) => {
    const item = {
      ...video,
      mediaType: mime.startsWith('video/') ? MediaType.VIDEO : MediaType.IMAGE,
    };
    const file = {
      ...mp4(),
      mimetype: mime,
      originalname: name,
      buffer: Buffer.from(bytes),
    };
    expect(() => validateClubinhoMedia([item], { video: file })).not.toThrow();
    expect(() =>
      validateClubinhoMedia([item], {
        video: { ...file, buffer: Buffer.from('invalid bytes') },
      }),
    ).toThrow();
  });

  it('rejects duplicate file bindings and truncated files', () => {
    const file = {
      ...mp4(),
      mimetype: 'image/jpeg',
      originalname: 'photo.jpg',
      buffer: Buffer.from([255, 216, 255, 0, 0, 0, 0, 0, 0, 0, 0, 0]),
    };
    const item = { ...video, mediaType: MediaType.IMAGE };
    expect(() =>
      validateClubinhoMedia([item, item], { video: file }),
    ).toThrow();
    expect(() =>
      validateClubinhoMedia([video], {
        video: { ...mp4(), buffer: Buffer.from([1]) },
      }),
    ).toThrow();
  });

  it('keeps a legacy album with more than 20 photos editable without requiring new uploads', () => {
    const existing = Array.from({ length: 25 }, (_, index) =>
      Object.assign(new MediaItemEntity(), {
        id: `legacy-${index}`,
        mediaType: MediaType.IMAGE,
        uploadType: UploadType.UPLOAD,
        isLocalFile: true,
        url: `https://bucket/old-${index}.jpg`,
      }),
    );
    const incoming = existing.map((media) => ({
      id: media.id,
      mediaType: media.mediaType,
      uploadType: media.uploadType,
      isLocalFile: true,
    }));
    expect(() => validateClubinhoMedia(incoming, {}, existing)).not.toThrow();
    expect(() =>
      validateClubinhoMedia([...incoming, photo], {}, existing),
    ).toThrow();
  });
});
