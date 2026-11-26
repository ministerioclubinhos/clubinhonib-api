import { AppValidationException } from 'src/shared/exceptions';
import { MediaItemEntity } from 'src/shared/media/media-item/media-item.entity';
import {
  MediaType,
  UploadType,
} from 'src/shared/media/media-item/media-item.entity';
import { MediaItemDto } from 'src/shared/share-dto/media-item-dto';
import { IdeasSectionEntity } from './entities/ideas-section.entity';
import { CreateIdeasPageDto } from './dto/create-ideas-page.dto';
import { UpdateIdeasPageDto } from './dto/update-ideas-page.dto';
import {
  assertUploadsHaveFiles,
  assertOwnedUniqueIds,
  assertMediaLinks,
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
    it('reconhece upload mesmo quando a flag local enviada é inconsistente', () => {
      expect(isUploadedMedia(upload())).toBe(true);
      expect(isUploadedMedia(upload({ isLocalFile: false }))).toBe(true);
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
      sections: [{ title: 'Ideia', description: '', medias: [] }],
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

  describe.each([CreateIdeasPageDto, UpdateIdeasPageDto])(
    'editor validation (%p)',
    (dtoClass) => {
      it('rejects an empty page with an actionable field error', async () => {
        await expect(
          parseAndValidatePayload(
            JSON.stringify({
              title: 'Ideias',
              description: 'Texto',
              sections: [],
            }),
            dtoClass,
          ),
        ).rejects.toMatchObject({
          message: 'Página · Seções: Adicione ao menos uma seção.',
          details: {
            fieldErrors: [
              {
                field: 'sections',
                message: 'Página · Seções: Adicione ao menos uma seção.',
              },
            ],
          },
        });
      });

      it('identifies nested section and media errors without exposing submitted content', async () => {
        const request = JSON.stringify({
          title: 'Ideias',
          description: 'Conteúdo reservado',
          sections: [
            { title: 'Ideia válida', description: '', medias: [] },
            {
              title: ' ',
              description: '',
              medias: [{ ...upload(), mediaType: 'private-invalid-value' }],
            },
          ],
        });
        const error: unknown = await parseAndValidatePayload(
          request,
          dtoClass,
        ).catch((caught: unknown) => caught);
        expect(error).toBeInstanceOf(AppValidationException);
        if (!(error instanceof AppValidationException))
          throw new Error('Expected validation error');
        expect(error.getStatus()).toBe(422);
        expect(error.getDetails()).toMatchObject({
          fieldErrors: [
            {
              field: 'sections.1.title',
              message: 'Seção 2 · Título: O título não pode ficar vazio.',
            },
            {
              field: 'sections.1.medias.0.mediaType',
              message: expect.stringContaining(
                'Seção 2 · Material 1 · Tipo de material:',
              ),
            },
          ],
        });
        expect(JSON.stringify(error.getResponse())).not.toContain(
          'Conteúdo reservado',
        );
        expect(JSON.stringify(error.getResponse())).not.toContain(
          'private-invalid-value',
        );
      });

      it('explains title limits in Portuguese', async () => {
        await expect(
          parseAndValidatePayload(
            JSON.stringify({
              title: 'Ideias',
              subtitle: 'x'.repeat(256),
              description: 'Texto',
              sections: [{ title: 'Ideia', description: '', medias: [] }],
            }),
            dtoClass,
          ),
        ).rejects.toMatchObject({
          message: 'Página · Subtítulo: Use até 255 caracteres.',
        });
      });
    },
  );

  it.each(['null', '[]', '42', '"text"', 'true'])(
    'recusa JSON %s com erro de validação',
    async (raw) => {
      await expect(
        parseAndValidatePayload(raw, CreateIdeasPageDto),
      ).rejects.toBeInstanceOf(AppValidationException);
    },
  );
  it.each(['', '   ', 'x'.repeat(256)])(
    'recusa título vazio ou acima do limite (%s)',
    async (title) => {
      await expect(
        parseAndValidatePayload(
          JSON.stringify({ title, description: 'Texto', sections: [] }),
          CreateIdeasPageDto,
        ),
      ).rejects.toBeInstanceOf(AppValidationException);
    },
  );
  it('recusa descrição da página vazia e título de seção vazio', async () => {
    for (const payload of [
      { title: 'Ideias', description: '  ', sections: [] },
      {
        title: 'Ideias',
        description: 'Texto',
        sections: [{ title: ' ', description: '', medias: [] }],
      },
    ])
      await expect(
        parseAndValidatePayload(JSON.stringify(payload), CreateIdeasPageDto),
      ).rejects.toBeInstanceOf(AppValidationException);
  });
  it('recusa ids repetidos, preserva ids próprios e permite itens novos', () => {
    expect(() =>
      assertOwnedUniqueIds([{ id: 'a' }, { id: 'a' }], [{ id: 'a' }], 'seção'),
    ).toThrow(AppValidationException);
    expect(() =>
      assertOwnedUniqueIds([{ id: 'other' }], [{ id: 'a' }], 'seção'),
    ).toThrow(AppValidationException);
    expect(() =>
      assertOwnedUniqueIds([{ id: 'a' }, {}], [{ id: 'a' }], 'seção'),
    ).not.toThrow();
  });
  it.each(['', 'javascript:alert(1)', 'blob:local', '/relative'])(
    'recusa link inválido %s',
    (url) => {
      expect(() =>
        assertMediaLinks([upload({ uploadType: UploadType.LINK, url })]),
      ).toThrow(AppValidationException);
    },
  );
  it('aceita HTTP(S), ignora URLs temporárias de uploads e aceita fileField legado', () => {
    expect(() =>
      assertMediaLinks([
        upload({
          uploadType: UploadType.LINK,
          url: ' https://example.org/file ',
        }),
        upload(),
      ]),
    ).not.toThrow();
    expect(() =>
      assertUploadsHaveFiles(
        [upload({ fieldKey: undefined, fileField: 'legacy' })],
        { legacy: {} as Express.Multer.File },
      ),
    ).not.toThrow();
  });
});
