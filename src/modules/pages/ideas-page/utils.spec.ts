import { AppValidationException } from 'src/shared/exceptions';
import { MediaItemEntity } from 'src/shared/media/media-item/media-item.entity';
import {
  MediaType,
  UploadType,
} from 'src/shared/media/media-item/media-item.entity';
import { MediaItemDto } from 'src/shared/share-dto/media-item-dto';
import { IdeasSectionEntity } from './entities/ideas-section.entity';
import { CreateIdeasPageDto } from './dto/create-ideas-page.dto';
import {
  assertUploadsHaveFiles,
  buildFilesDict,
  collectSectionIds,
  groupMediaBySection,
  isUploadedMedia,
  parseAndValidatePayload,
  planSectionSync,
  toMediaItemInputs,
} from './utils';

const section = (id: string): IdeasSectionEntity =>
  Object.assign(new IdeasSectionEntity(), { id, title: id, description: '' });

const media = (targetId: string, id: string): MediaItemEntity =>
  Object.assign(new MediaItemEntity(), { id, targetId });

const upload = (overrides: Partial<MediaItemDto> = {}): MediaItemDto =>
  Object.assign(new MediaItemDto(), {
    title: 'Foto',
    description: '',
    mediaType: MediaType.IMAGE,
    uploadType: UploadType.UPLOAD,
    isLocalFile: true,
    fieldKey: 'image_0_0.png',
    ...overrides,
  });

describe('utils da página de ideias', () => {
  describe('buildFilesDict', () => {
    it('indexa os arquivos pelo nome do campo', () => {
      const file = { fieldname: 'a.png' } as Express.Multer.File;

      expect(buildFilesDict([file])).toEqual({ 'a.png': file });
    });

    it('devolve um dicionário vazio sem arquivos', () => {
      expect(buildFilesDict()).toEqual({});
    });
  });

  describe('groupMediaBySection', () => {
    it('agrupa as mídias pelo alvo', () => {
      const grouped = groupMediaBySection([
        media('s1', 'm1'),
        media('s2', 'm2'),
        media('s1', 'm3'),
      ]);

      expect(grouped.get('s1')?.map((item) => item.id)).toEqual(['m1', 'm3']);
      expect(grouped.get('s2')?.map((item) => item.id)).toEqual(['m2']);
    });
  });

  describe('collectSectionIds', () => {
    it('reúne os ids das seções de várias páginas', () => {
      expect(
        collectSectionIds([
          { sections: [section('a'), section('b')] },
          { sections: undefined },
          { sections: [section('c')] },
        ]),
      ).toEqual(['a', 'b', 'c']);
    });
  });

  describe('planSectionSync', () => {
    it('separa remoções, atualizações e criações', () => {
      const plan = planSectionSync(
        [section('s1'), section('s2')],
        [{ id: 's1' }, {}],
      );

      expect(plan.toRemove).toEqual(['s2']);
      expect(plan.toUpdate).toEqual([{ id: 's1' }]);
      expect(plan.toCreate).toEqual([{}]);
    });
  });

  describe('isUploadedMedia', () => {
    it('reconhece só o arquivo local marcado como upload', () => {
      expect(isUploadedMedia(upload())).toBe(true);
      expect(isUploadedMedia(upload({ isLocalFile: false }))).toBe(false);
      expect(isUploadedMedia(upload({ uploadType: UploadType.LINK }))).toBe(
        false,
      );
    });
  });

  describe('assertUploadsHaveFiles', () => {
    it('aceita quando todo upload tem arquivo', () => {
      expect(() =>
        assertUploadsHaveFiles([upload()], {
          'image_0_0.png': {} as Express.Multer.File,
        }),
      ).not.toThrow();
    });

    it('recusa upload sem fieldKey', () => {
      expect(() =>
        assertUploadsHaveFiles([upload({ fieldKey: undefined })], {}),
      ).toThrow(AppValidationException);
    });

    it('recusa upload cujo arquivo não foi enviado', () => {
      expect(() => assertUploadsHaveFiles([upload()], {})).toThrow(
        AppValidationException,
      );
    });

    it('ignora mídias que não são upload', () => {
      expect(() =>
        assertUploadsHaveFiles(
          [upload({ uploadType: UploadType.LINK, isLocalFile: false })],
          {},
        ),
      ).not.toThrow();
    });
  });

  describe('toMediaItemInputs', () => {
    it('copia fieldKey para fileField, que é o que o processador lê', () => {
      expect(toMediaItemInputs([upload()])[0].fileField).toBe('image_0_0.png');
    });
  });

  describe('parseAndValidatePayload', () => {
    const valid = JSON.stringify({
      title: 'Ideias',
      description: 'Descrição',
      sections: [],
    });

    it('devolve o DTO validado', async () => {
      const dto = await parseAndValidatePayload(valid, CreateIdeasPageDto);

      expect(dto).toBeInstanceOf(CreateIdeasPageDto);
      expect(dto.title).toBe('Ideias');
    });

    it('recusa payload ausente', async () => {
      await expect(
        parseAndValidatePayload(undefined, CreateIdeasPageDto),
      ).rejects.toBeInstanceOf(AppValidationException);
    });

    it('recusa JSON inválido', async () => {
      await expect(
        parseAndValidatePayload('{', CreateIdeasPageDto),
      ).rejects.toBeInstanceOf(AppValidationException);
    });

    it('recusa payload que não satisfaz o contrato', async () => {
      await expect(
        parseAndValidatePayload('{"title": 1}', CreateIdeasPageDto),
      ).rejects.toBeInstanceOf(AppValidationException);
    });

    it('recusa campo desconhecido', async () => {
      await expect(
        parseAndValidatePayload(
          JSON.stringify({
            title: 'Ideias',
            description: 'Descrição',
            sections: [],
            inesperado: true,
          }),
          CreateIdeasPageDto,
        ),
      ).rejects.toBeInstanceOf(AppValidationException);
    });
  });
});
