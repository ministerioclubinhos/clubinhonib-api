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
  duplicateSearchFragments,
  isDuplicateWeekMaterial,
  isSpecialWeekMaterial,
  normalizeWeekMaterialTitle,
  stripWeekMaterialMarkers,
  titleNamesWeek,
  weekMaterialOriginMarker,
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

  describe('internal markers', () => {
    it('detects the special tag', () => {
      expect(isSpecialWeekMaterial('Texto. [tipo:especial]')).toBe(true);
      expect(isSpecialWeekMaterial('Texto comum')).toBe(false);
      expect(isSpecialWeekMaterial(null)).toBe(false);
    });

    it('strips the special tag and the legacy origin marker from public text', () => {
      expect(
        stripWeekMaterialMarkers(
          'Material Especial completo. [tipo:especial] [origem:licao:2f6f0c1e-1111-4222-8333-444444444444]',
        ),
      ).toBe('Material Especial completo.');
      expect(stripWeekMaterialMarkers('Sem marcas')).toBe('Sem marcas');
      expect(stripWeekMaterialMarkers(undefined)).toBe('');
    });

    it('builds the legacy origin marker of a lesson', () => {
      expect(weekMaterialOriginMarker('abc')).toBe('[origem:licao:abc]');
    });
  });

  describe('duplicate detection', () => {
    it('normalizes case, accents, punctuation and spacing of a title', () => {
      expect(normalizeWeekMaterialTitle('  Semana 12 — O Bom  Pastor! ')).toBe(
        'semana 12 o bom pastor',
      );
      expect(normalizeWeekMaterialTitle('Páscoa')).toBe('pascoa');
    });

    it('matches the week as a whole number', () => {
      expect(titleNamesWeek('Semana 1 — Criação', 1)).toBe(true);
      expect(titleNamesWeek('SEMANA 01', 1)).toBe(true);
      expect(titleNamesWeek('Semana 12 — Davi', 1)).toBe(false);
      expect(titleNamesWeek('Semana 21', 1)).toBe(false);
      expect(titleNamesWeek('Material Especial (Semana 3) — Tema', 3)).toBe(
        true,
      );
      expect(titleNamesWeek('Tema sem semana', 3)).toBe(false);
    });

    it('searches a weekly material by the week and a special one by its longest words', () => {
      expect(
        duplicateSearchFragments({
          title: 'Semana 12 — Davi',
          weekNumber: 12,
          special: false,
        }),
      ).toEqual(['semana', '12']);
      expect(
        duplicateSearchFragments({
          title: 'Material Especial — O Picolé Roubado',
          special: true,
        }),
      ).toEqual(['material', 'especial', 'roubado']);
      expect(
        duplicateSearchFragments({
          title: 'x',
          weekNumber: null,
          special: false,
        }),
      ).toEqual([]);
      expect(duplicateSearchFragments({ title: '🎉', special: true })).toEqual(
        [],
      );
    });

    it('treats as duplicate the same week (weekly) or the same title (special)', () => {
      const weekly = {
        title: 'Semana 12 — Davi',
        weekNumber: 12,
        special: false,
      };
      expect(
        isDuplicateWeekMaterial({ id: 'a', title: 'Semana 12' }, weekly),
      ).toBe(true);
      expect(
        isDuplicateWeekMaterial({ id: 'a', title: 'Semana 120' }, weekly),
      ).toBe(false);
      // A special material that mentions the week is not the weekly material.
      expect(
        isDuplicateWeekMaterial(
          {
            id: 'a',
            title: 'Material Especial (Semana 12) — X',
            description: 'x [tipo:especial]',
          },
          weekly,
        ),
      ).toBe(false);
      // The caller's own page is never reported.
      expect(
        isDuplicateWeekMaterial(
          { id: 'own', title: 'Semana 12' },
          { ...weekly, excludePageId: 'own' },
        ),
      ).toBe(false);

      const special = {
        title: 'Material Especial — O Picolé Roubado',
        special: true,
      };
      expect(
        isDuplicateWeekMaterial(
          { id: 'a', title: 'material especial - o picole roubado' },
          special,
        ),
      ).toBe(true);
      expect(
        isDuplicateWeekMaterial(
          { id: 'a', title: 'Material Especial — Outro tema' },
          special,
        ),
      ).toBe(false);
    });
  });
});
