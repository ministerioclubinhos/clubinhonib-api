import { AppValidationException } from 'src/shared/exceptions';
import {
  MediaItemEntity,
  MediaType,
  UploadType,
} from 'src/shared/media/media-item/media-item.entity';
import { CreateImagePageDto } from './dto/create-image.dto';
import { ImageSectionEntity } from './entity/Image-section.entity';
import {
  assertNewUploadsHaveFiles,
  buildFilesDict,
  collectSectionIds,
  groupMediaBySection,
  parseAndValidatePayload,
  planSectionSync,
} from './utils';

const section = (id: string): ImageSectionEntity =>
  Object.assign(new ImageSectionEntity(), {
    id,
    caption: `Seção ${id}`,
    description: '',
    public: true,
  });

const media = (id: string, targetId: string): MediaItemEntity =>
  Object.assign(new MediaItemEntity(), {
    id,
    title: id,
    description: '',
    mediaType: MediaType.IMAGE,
    uploadType: UploadType.LINK,
    url: 'https://example.com/a.png',
    isLocalFile: false,
    targetId,
    targetType: 'ImagesPage',
  });

const validPayload = (overrides: Record<string, unknown> = {}) => ({
  title: 'Galeria de fotos',
  description: 'Fotos do evento',
  public: true,
  sections: [
    {
      caption: 'Abertura',
      description: 'Fotos da abertura',
      public: true,
      mediaItems: [
        {
          title: 'Foto 1',
          description: '',
          mediaType: MediaType.IMAGE,
          uploadType: UploadType.LINK,
          isLocalFile: false,
          url: 'https://example.com/a.png',
        },
      ],
    },
  ],
  ...overrides,
});

describe('image page utils', () => {
  describe('buildFilesDict', () => {
    it('indexa os arquivos pelo campo multipart', () => {
      const file = { fieldname: 'image_0' } as Express.Multer.File;
      expect(buildFilesDict([file])).toEqual({ image_0: file });
    });

    it('devolve dicionário vazio sem arquivos', () => {
      expect(buildFilesDict()).toEqual({});
    });
  });

  describe('groupMediaBySection', () => {
    it('agrupa as mídias por seção', () => {
      const grouped = groupMediaBySection([
        media('m1', 's1'),
        media('m2', 's2'),
        media('m3', 's1'),
      ]);

      expect(grouped.get('s1')?.map((item) => item.id)).toEqual(['m1', 'm3']);
      expect(grouped.get('s2')?.map((item) => item.id)).toEqual(['m2']);
    });
  });

  describe('collectSectionIds', () => {
    it('junta os ids das seções de todas as galerias', () => {
      expect(
        collectSectionIds([
          { sections: [section('a'), section('b')] },
          { sections: [section('c')] },
        ]),
      ).toEqual(['a', 'b', 'c']);
    });

    it('tolera galeria sem a relação carregada', () => {
      expect(collectSectionIds([{}])).toEqual([]);
    });
  });

  describe('planSectionSync', () => {
    it('remove as que sumiram, atualiza as com id e cria o resto', () => {
      const plan = planSectionSync(
        [section('keep'), section('drop')],
        [{ id: 'keep' }, { caption: 'nova' } as { id?: string }],
      );

      expect(plan.toRemove).toEqual(['drop']);
      expect(plan.toUpdate.map((s) => s.id)).toEqual(['keep']);
      expect(plan.toCreate).toHaveLength(1);
    });

    it('remove tudo quando o payload não traz seções', () => {
      expect(planSectionSync([section('a')], []).toRemove).toEqual(['a']);
    });
  });

  describe('parseAndValidatePayload', () => {
    it('devolve o DTO validado', async () => {
      const dto = await parseAndValidatePayload(
        JSON.stringify(validPayload()),
        CreateImagePageDto,
      );

      expect(dto).toBeInstanceOf(CreateImagePageDto);
      expect(dto.sections).toHaveLength(1);
    });

    it('recusa payload ausente', async () => {
      await expect(
        parseAndValidatePayload(undefined, CreateImagePageDto),
      ).rejects.toBeInstanceOf(AppValidationException);
    });

    it('recusa JSON malformado', async () => {
      await expect(
        parseAndValidatePayload('{quebrado', CreateImagePageDto),
      ).rejects.toBeInstanceOf(AppValidationException);
    });

    it('recusa propriedade desconhecida', async () => {
      await expect(
        parseAndValidatePayload(
          JSON.stringify(validPayload({ inesperado: 1 })),
          CreateImagePageDto,
        ),
      ).rejects.toBeInstanceOf(AppValidationException);
    });
  });
});

describe('validação do payload da galeria', () => {
  const validMedia = {
    title: 'Foto',
    description: '',
    uploadType: UploadType.LINK,
    mediaType: MediaType.IMAGE,
    isLocalFile: false,
    url: 'https://exemplo.com/a.png',
  };
  const payload = (overrides: Record<string, unknown> = {}): string =>
    JSON.stringify({
      title: 'Galeria',
      description: 'Descrição',
      public: true,
      sections: [
        {
          caption: 'Seção',
          description: '',
          public: true,
          mediaItems: [validMedia],
        },
      ],
      ...overrides,
    });

  const failure = async (raw: string): Promise<AppValidationException> =>
    parseAndValidatePayload(raw, CreateImagePageDto).then(
      () => {
        throw new Error('deveria recusar');
      },
      (error: unknown) => error as AppValidationException,
    );

  const fieldErrorsOf = (
    error: AppValidationException,
  ): { field: string; message: string }[] =>
    (error.details as { fieldErrors: { field: string; message: string }[] })
      .fieldErrors;

  it('aceita um payload válido', async () => {
    await expect(
      parseAndValidatePayload(payload(), CreateImagePageDto),
    ).resolves.toMatchObject({
      title: 'Galeria',
    });
  });

  it('recusa título e descrição em branco, com mensagem em português', async () => {
    const error = await failure(payload({ title: '   ', description: ' ' }));
    const messages = fieldErrorsOf(error).map((item) => item.message);
    expect(messages).toContain(
      'Galeria · Título: O título não pode ficar vazio.',
    );
    expect(messages).toContain(
      'Galeria · Descrição: A descrição da galeria não pode ficar vazia.',
    );
  });

  it('exige ao menos uma seção', async () => {
    const error = await failure(payload({ sections: [] }));
    expect(fieldErrorsOf(error)[0].message).toContain(
      'Adicione ao menos uma seção.',
    );
  });

  it('aponta a seção e a imagem com problema, uma posição a partir de 1', async () => {
    const error = await failure(
      payload({
        sections: [
          {
            caption: 'Ok',
            description: '',
            public: true,
            mediaItems: [validMedia],
          },
          {
            caption: 'x'.repeat(256),
            description: '',
            public: true,
            mediaItems: [validMedia, { ...validMedia, uploadType: 'foo' }],
          },
        ],
      }),
    );
    const byField = Object.fromEntries(
      fieldErrorsOf(error).map((item) => [item.field, item.message]),
    );
    expect(byField['sections.1.caption']).toContain('Seção 2 · Legenda');
    expect(byField['sections.1.mediaItems.1.uploadType']).toContain(
      'Seção 2 · Imagem 2',
    );
  });

  it('recusa JSON que não é objeto', async () => {
    await expect(
      parseAndValidatePayload('[]', CreateImagePageDto),
    ).rejects.toBeInstanceOf(AppValidationException);
  });
});

describe('assertNewUploadsHaveFiles', () => {
  const upload = (extra: Record<string, unknown>) =>
    ({
      title: 'Foto',
      uploadType: UploadType.UPLOAD,
      mediaType: MediaType.IMAGE,
      isLocalFile: true,
      ...extra,
    }) as never;
  const file = { fieldname: 'f' } as Express.Multer.File;

  it('aceita upload novo com arquivo e imagem já salva sem fieldKey', () => {
    expect(() =>
      assertNewUploadsHaveFiles(
        [upload({ fieldKey: 'f' }), upload({ id: 'm1' })],
        { f: file },
      ),
    ).not.toThrow();
  });

  it('recusa upload novo sem fieldKey ou sem o arquivo no multipart', () => {
    expect(() => assertNewUploadsHaveFiles([upload({})], {})).toThrow(
      AppValidationException,
    );
    expect(() =>
      assertNewUploadsHaveFiles([upload({ fieldKey: 'f' })], {}),
    ).toThrow(AppValidationException);
  });

  it('ignora links', () => {
    expect(() =>
      assertNewUploadsHaveFiles([upload({ uploadType: UploadType.LINK })], {}),
    ).not.toThrow();
  });
});
