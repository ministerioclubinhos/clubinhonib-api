import { AppValidationException } from 'src/shared/exceptions';
import {
  MediaItemEntity,
  MediaType,
  UploadType,
} from 'src/shared/media/media-item/media-item.entity';
import { MediaItemDto } from 'src/shared/share-dto/media-item-dto';
import { CreateVideosPageDto } from './dto/create-videos-page.dto';
import {
  assertUploadFieldKeys,
  assertVideoLinks,
  assertUploadFilesPresent,
  buildFilesDict,
  isUploadedVideo,
  normalizeIncomingVideos,
  parseAndValidatePayload,
  planVideoSync,
} from './utils';

const videoDto = (overrides: Partial<MediaItemDto> = {}): MediaItemDto => ({
  title: 'Vídeo',
  description: 'Descrição',
  uploadType: UploadType.LINK,
  mediaType: MediaType.VIDEO,
  isLocalFile: false,
  url: 'https://youtube.com/embed/a',
  ...overrides,
});

const videoEntity = (id: string): MediaItemEntity =>
  Object.assign(new MediaItemEntity(), {
    id,
    title: id,
    description: '',
    mediaType: MediaType.VIDEO,
    uploadType: UploadType.LINK,
    url: `https://example.com/${id}`,
    isLocalFile: false,
    targetId: 'page-id',
    targetType: 'VideosPage',
  });

const multerFile = (fieldname: string): Express.Multer.File =>
  ({
    fieldname,
    originalname: `${fieldname}.mp4`,
    size: 10,
  }) as Express.Multer.File;

const validPayload = (overrides: Record<string, unknown> = {}) => ({
  title: 'Galeria de vídeos',
  description: 'Vídeos do evento',
  public: true,
  videos: [
    {
      title: 'Vídeo',
      description: 'Descrição',
      uploadType: UploadType.LINK,
      mediaType: MediaType.VIDEO,
      isLocalFile: false,
      url: 'https://youtube.com/embed/a',
    },
  ],
  ...overrides,
});

describe('video page utils', () => {
  describe('buildFilesDict', () => {
    it('indexa os arquivos pelo campo multipart', () => {
      const file = multerFile('video_0');
      expect(buildFilesDict([file])).toEqual({ video_0: file });
    });

    it('devolve dicionário vazio sem arquivos', () => {
      expect(buildFilesDict()).toEqual({});
    });
  });

  describe('isUploadedVideo', () => {
    it('detecta upload por uploadType e por isLocalFile', () => {
      expect(isUploadedVideo(videoDto({ uploadType: UploadType.UPLOAD }))).toBe(
        true,
      );
      expect(isUploadedVideo(videoDto({ isLocalFile: true }))).toBe(true);
      expect(isUploadedVideo(videoDto())).toBe(false);
    });
  });

  describe('normalizeIncomingVideos', () => {
    it('resolve fileField a partir de fieldKey só para uploads', () => {
      const [uploaded, linked] = normalizeIncomingVideos([
        videoDto({ uploadType: UploadType.UPLOAD, fieldKey: 'video_0' }),
        videoDto({ fieldKey: 'ignorado' }),
      ]);

      expect(uploaded.fileField).toBe('video_0');
      expect(linked.fileField).toBeUndefined();
    });

    it('tolera lista ausente', () => {
      expect(normalizeIncomingVideos()).toEqual([]);
    });
  });

  describe('assertUploadFieldKeys', () => {
    it('recusa upload sem campo multipart', () => {
      expect(() =>
        assertUploadFieldKeys([videoDto({ uploadType: UploadType.UPLOAD })]),
      ).toThrow(AppValidationException);
    });

    it('aceita link sem campo multipart', () => {
      expect(() => assertUploadFieldKeys([videoDto()])).not.toThrow();
    });
  });

  describe('assertUploadFilesPresent', () => {
    it('recusa upload cujo arquivo não veio', () => {
      const item = {
        ...videoDto({ uploadType: UploadType.UPLOAD }),
        fileField: 'video_0',
      };
      expect(() => assertUploadFilesPresent([item], {})).toThrow(
        AppValidationException,
      );
    });

    it('aceita quando o arquivo está presente', () => {
      const item = {
        ...videoDto({ uploadType: UploadType.UPLOAD }),
        fileField: 'video_0',
      };
      expect(() =>
        assertUploadFilesPresent([item], { video_0: multerFile('video_0') }),
      ).not.toThrow();
    });
  });

  describe('planVideoSync', () => {
    it('remove os que sumiram, atualiza os com id e cria o resto', () => {
      const plan = planVideoSync(
        [videoEntity('keep'), videoEntity('drop')],
        [videoDto({ id: 'keep' }), videoDto({ title: 'novo' })],
      );

      expect(plan.toRemove.map((item) => item.id)).toEqual(['drop']);
      expect(plan.toUpdate.map((item) => item.id)).toEqual(['keep']);
      expect(plan.toCreate.map((item) => item.title)).toEqual(['novo']);
    });

    it('remove tudo quando o payload vem sem vídeos', () => {
      expect(planVideoSync([videoEntity('a')], []).toRemove).toHaveLength(1);
    });
  });

  describe('parseAndValidatePayload', () => {
    it('devolve o DTO validado', async () => {
      const dto = await parseAndValidatePayload(
        JSON.stringify(validPayload()),
        CreateVideosPageDto,
      );

      expect(dto).toBeInstanceOf(CreateVideosPageDto);
      expect(dto.videos).toHaveLength(1);
    });

    it('recusa payload ausente e JSON malformado', async () => {
      await expect(
        parseAndValidatePayload(undefined, CreateVideosPageDto),
      ).rejects.toBeInstanceOf(AppValidationException);
      await expect(
        parseAndValidatePayload('{quebrado', CreateVideosPageDto),
      ).rejects.toBeInstanceOf(AppValidationException);
    });

    it('recusa propriedade desconhecida', async () => {
      await expect(
        parseAndValidatePayload(
          JSON.stringify(validPayload({ inesperado: true })),
          CreateVideosPageDto,
        ),
      ).rejects.toBeInstanceOf(AppValidationException);
    });
  });
});

describe('validação do payload da galeria de vídeos', () => {
  const video = {
    title: 'Vídeo',
    description: 'Descrição',
    uploadType: UploadType.LINK,
    mediaType: MediaType.VIDEO,
    isLocalFile: false,
    url: 'https://youtu.be/abc',
  };
  const payload = (overrides: Record<string, unknown> = {}): string =>
    JSON.stringify({
      title: 'Galeria',
      description: 'Descrição',
      public: true,
      videos: [video],
      ...overrides,
    });
  const fieldErrorsOf = async (
    raw: string,
  ): Promise<{ field: string; message: string }[]> => {
    try {
      await parseAndValidatePayload(raw, CreateVideosPageDto);
    } catch (error) {
      return (
        (error as AppValidationException).details as {
          fieldErrors: { field: string; message: string }[];
        }
      ).fieldErrors;
    }
    throw new Error('deveria recusar');
  };

  it('aceita um payload válido, inclusive sem vídeos', async () => {
    await expect(
      parseAndValidatePayload(payload(), CreateVideosPageDto),
    ).resolves.toMatchObject({ title: 'Galeria' });
    await expect(
      parseAndValidatePayload(payload({ videos: [] }), CreateVideosPageDto),
    ).resolves.toBeDefined();
  });

  it('recusa título e descrição em branco e título acima de 255', async () => {
    const blank = await fieldErrorsOf(
      payload({ title: ' ', description: ' ' }),
    );
    const messages = blank.map((item) => item.message);
    expect(messages).toContain(
      'Galeria · Título: O título não pode ficar vazio.',
    );
    expect(messages).toContain(
      'Galeria · Descrição: A descrição da página não pode ficar vazia.',
    );
    const long = await fieldErrorsOf(payload({ title: 'x'.repeat(256) }));
    expect(long[0].message).toContain('Use até 255 caracteres.');
  });

  it('aponta o vídeo com problema, contando a partir de 1', async () => {
    const errors = await fieldErrorsOf(
      payload({ videos: [video, { ...video, uploadType: 'foo' }] }),
    );
    expect(
      errors.find((item) => item.field === 'videos.1.uploadType')?.message,
    ).toContain('Vídeo 2 · Tipo de envio');
  });

  it('assertVideoLinks aponta o vídeo de link inválido', () => {
    expect(() =>
      assertVideoLinks([
        Object.assign(new MediaItemDto(), { ...video, url: 'youtube.com/x' }),
      ]),
    ).toThrow('Vídeo 1 · Link');
  });
});
