import { AppValidationException } from 'src/shared/exceptions';
import {
  MediaItemEntity,
  MediaType,
  UploadType,
} from 'src/shared/media/media-item/media-item.entity';
import { CreateImagePageDto } from './dto/create-image.dto';
import { ImageSectionEntity } from './entity/Image-section.entity';
import {
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
