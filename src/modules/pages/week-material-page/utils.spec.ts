import {
  MediaItemEntity,
  MediaType,
  PlatformType,
  UploadType,
} from 'src/shared/media/media-item/media-item.entity';
import { MediaItemDto } from 'src/shared/share-dto/media-item-dto';
import { AppValidationException } from 'src/shared/exceptions';
import { CreateWeekMaterialsPageDto } from './dto/create-week-material.dto';
import {
  assertUploadFieldKeys,
  assertUploadFilesPresent,
  buildFilesDict,
  groupMediaByType,
  isUploadedMedia,
  normalizeIncomingMedia,
  parseAndValidatePayload,
  planMediaSync,
  resolveUploadedFile,
} from './utils';

const mediaDto = (overrides: Partial<MediaItemDto> = {}): MediaItemDto => ({
  title: 'Título',
  description: 'Descrição',
  uploadType: UploadType.LINK,
  mediaType: MediaType.VIDEO,
  isLocalFile: false,
  url: 'https://example.com/a',
  ...overrides,
});

const mediaEntity = (
  id: string,
  mediaType: MediaType,
  overrides: Partial<MediaItemEntity> = {},
): MediaItemEntity =>
  Object.assign(new MediaItemEntity(), {
    id,
    title: `media-${id}`,
    description: '',
    mediaType,
    uploadType: UploadType.LINK,
    url: `https://example.com/${id}`,
    isLocalFile: false,
    targetId: 'page-id',
    targetType: 'WeekMaterialsPage',
    ...overrides,
  });

const multerFile = (fieldname: string): Express.Multer.File =>
  ({
    fieldname,
    originalname: `${fieldname}.mp4`,
    size: 10,
  }) as Express.Multer.File;

describe('week material utils', () => {
  describe('buildFilesDict', () => {
    it('indexes files by their multipart field name', () => {
      const file = multerFile('video_0');
      expect(buildFilesDict([file])).toEqual({ video_0: file });
    });

    it('returns an empty dictionary when no file was uploaded', () => {
      expect(buildFilesDict()).toEqual({});
    });
  });

  describe('isUploadedMedia', () => {
    it('detects uploads by uploadType and by isLocalFile', () => {
      expect(isUploadedMedia(mediaDto({ uploadType: UploadType.UPLOAD }))).toBe(
        true,
      );
      expect(isUploadedMedia(mediaDto({ isLocalFile: true }))).toBe(true);
      expect(isUploadedMedia(mediaDto())).toBe(false);
    });
  });

  describe('normalizeIncomingMedia', () => {
    it('flattens every group and forces its media type', () => {
      const normalized = normalizeIncomingMedia({
        videos: [mediaDto({ mediaType: MediaType.IMAGE })],
        documents: [mediaDto()],
        images: [mediaDto()],
        audios: [mediaDto()],
      });

      expect(normalized.map((item) => item.mediaType)).toEqual([
        MediaType.VIDEO,
        MediaType.DOCUMENT,
        MediaType.IMAGE,
        MediaType.AUDIO,
      ]);
    });

    it('resolves fileField from fieldKey only for uploaded media', () => {
      const [uploaded, linked] = normalizeIncomingMedia({
        videos: [
          mediaDto({ uploadType: UploadType.UPLOAD, fieldKey: 'video_0' }),
          mediaDto({ fieldKey: 'ignored' }),
        ],
      });

      expect(uploaded.fileField).toBe('video_0');
      expect(linked.fileField).toBeUndefined();
    });

    it('returns an empty list when no media was sent', () => {
      expect(normalizeIncomingMedia({})).toEqual([]);
    });
  });

  describe('assertUploadFieldKeys', () => {
    it('accepts uploads carrying their multipart field', () => {
      expect(() =>
        assertUploadFieldKeys([
          { ...mediaDto({ uploadType: UploadType.UPLOAD }), fileField: 'v_0' },
        ]),
      ).not.toThrow();
    });

    it('rejects uploads without a multipart field', () => {
      expect(() =>
        assertUploadFieldKeys([mediaDto({ uploadType: UploadType.UPLOAD })]),
      ).toThrow(AppValidationException);
    });
  });

  describe('assertUploadFilesPresent', () => {
    it('accepts uploads whose file was sent', () => {
      const item = {
        ...mediaDto({ uploadType: UploadType.UPLOAD }),
        fileField: 'v_0',
      };
      expect(() =>
        assertUploadFilesPresent([item], { v_0: multerFile('v_0') }),
      ).not.toThrow();
    });

    it('ignores linked media', () => {
      expect(() => assertUploadFilesPresent([mediaDto()], {})).not.toThrow();
    });

    it('rejects an upload whose file is missing', () => {
      const item = {
        ...mediaDto({ uploadType: UploadType.UPLOAD }),
        fileField: 'v_0',
      };
      expect(() => assertUploadFilesPresent([item], {})).toThrow(
        AppValidationException,
      );
    });
  });

  describe('resolveUploadedFile', () => {
    it('returns the uploaded file of the item', () => {
      const file = multerFile('video_0');
      const item = { ...mediaDto(), fileField: 'video_0' };
      expect(resolveUploadedFile(item, { video_0: file })).toBe(file);
    });

    it('fails when the item has no multipart field', () => {
      expect(() => resolveUploadedFile(mediaDto(), {})).toThrow(
        AppValidationException,
      );
    });

    it('fails when the declared file is missing from the request', () => {
      const item = { ...mediaDto(), fileField: 'video_0' };
      expect(() => resolveUploadedFile(item, {})).toThrow(
        AppValidationException,
      );
    });
  });

  describe('groupMediaByType', () => {
    it('splits persisted media per media type', () => {
      const grouped = groupMediaByType([
        mediaEntity('1', MediaType.VIDEO),
        mediaEntity('2', MediaType.DOCUMENT),
        mediaEntity('3', MediaType.IMAGE),
        mediaEntity('4', MediaType.AUDIO),
        mediaEntity('5', MediaType.VIDEO),
      ]);

      expect(grouped.videos.map((i) => i.id)).toEqual(['1', '5']);
      expect(grouped.documents.map((i) => i.id)).toEqual(['2']);
      expect(grouped.images.map((i) => i.id)).toEqual(['3']);
      expect(grouped.audios.map((i) => i.id)).toEqual(['4']);
    });
  });

  describe('planMediaSync', () => {
    it('removes dropped items, updates known ids and creates the rest', () => {
      const existing = [
        mediaEntity('keep', MediaType.VIDEO),
        mediaEntity('drop', MediaType.VIDEO),
      ];
      const incoming = [
        mediaDto({ id: 'keep' }),
        mediaDto({ id: undefined, title: 'novo' }),
      ];

      const plan = planMediaSync(existing, incoming);

      expect(plan.toRemove.map((i) => i.id)).toEqual(['drop']);
      expect(plan.toUpdate.map((i) => i.id)).toEqual(['keep']);
      expect(plan.toCreate.map((i) => i.title)).toEqual(['novo']);
    });

    it('removes everything when the client sent no media', () => {
      const existing = [mediaEntity('a', MediaType.AUDIO)];
      expect(planMediaSync(existing, []).toRemove).toHaveLength(1);
    });
  });

  describe('parseAndValidatePayload', () => {
    it('returns a validated DTO instance', async () => {
      const dto = await parseAndValidatePayload(
        JSON.stringify({
          pageTitle: 'Semana 1',
          pageSubtitle: 'Tema',
          pageDescription: 'Descrição',
          videos: [
            {
              title: 'v',
              description: 'd',
              uploadType: UploadType.LINK,
              mediaType: MediaType.VIDEO,
              isLocalFile: false,
              url: 'https://example.com',
              platformType: PlatformType.YOUTUBE,
            },
          ],
        }),
        CreateWeekMaterialsPageDto,
      );

      expect(dto).toBeInstanceOf(CreateWeekMaterialsPageDto);
      expect(dto.videos).toHaveLength(1);
    });

    it('rejects a missing payload', async () => {
      await expect(
        parseAndValidatePayload(undefined, CreateWeekMaterialsPageDto),
      ).rejects.toBeInstanceOf(AppValidationException);
    });

    it('rejects a malformed JSON payload', async () => {
      await expect(
        parseAndValidatePayload('{invalid', CreateWeekMaterialsPageDto),
      ).rejects.toBeInstanceOf(AppValidationException);
    });

    it('rejects a payload that breaks the DTO contract', async () => {
      await expect(
        parseAndValidatePayload(
          JSON.stringify({ pageTitle: 1 }),
          CreateWeekMaterialsPageDto,
        ),
      ).rejects.toBeInstanceOf(AppValidationException);
    });

    it('rejects unknown properties', async () => {
      await expect(
        parseAndValidatePayload(
          JSON.stringify({
            pageTitle: 'a',
            pageSubtitle: 'b',
            pageDescription: 'c',
            unexpected: true,
          }),
          CreateWeekMaterialsPageDto,
        ),
      ).rejects.toBeInstanceOf(AppValidationException);
    });
  });
});
