import { ImageSectionEntity } from 'src/modules/pages/image-page/entity/Image-section.entity';
import { MediaItemEntity } from 'src/shared/media/media-item/media-item.entity';

import { groupMediasBySection, toImageSectionResponse } from './mappers';

/**
 * Trava o formato da resposta de fotos do clubinho.
 *
 * O front declara os mesmos campos em `src/features/image-sections/types.ts`.
 */
describe('toImageSectionResponse (contrato de resposta)', () => {
  const section = {
    id: 'section-1',
    caption: 'Páscoa no Clubinho 12',
    description: 'Fotos da manhã de sábado',
    public: false,
    page: null,
    createdAt: new Date('2026-03-01T10:00:00Z'),
    updatedAt: new Date('2026-03-02T10:00:00Z'),
  } as unknown as ImageSectionEntity;

  it('expõe exatamente os campos do contrato', () => {
    expect(Object.keys(toImageSectionResponse(section)).sort()).toEqual(
      [
        'caption',
        'createdAt',
        'description',
        'id',
        'mediaItems',
        'pageId',
        'public',
        'updatedAt',
      ].sort(),
    );
  });

  it('diz se a publicação já entrou no feed', () => {
    // `pageId` nulo é o que distingue a pendente da já aprovada.
    expect(toImageSectionResponse(section).pageId).toBeNull();

    const aprovada = {
      ...section,
      page: { id: 'page-1' },
    } as unknown as ImageSectionEntity;

    expect(toImageSectionResponse(aprovada).pageId).toBe('page-1');
  });

  it('entrega a foto no recorte do contrato, sem a entidade inteira', () => {
    const media = {
      id: 'media-1',
      title: 'Foto',
      description: null,
      uploadType: 'upload',
      mediaType: 'image',
      isLocalFile: true,
      url: 'https://example.com/foto.jpg',
      platformType: null,
      originalName: 'foto.jpg',
      size: 2048,
      targetId: 'section-1',
      targetType: 'ImagesPage',
    } as unknown as MediaItemEntity;

    const response = toImageSectionResponse(section, [media]);

    expect(Object.keys(response.mediaItems[0]).sort()).toEqual(
      [
        'description',
        'id',
        'isLocalFile',
        'mediaType',
        'originalName',
        'platformType',
        'size',
        'title',
        'uploadType',
        'url',
      ].sort(),
    );
    expect(response.mediaItems[0]).not.toHaveProperty('targetId');
  });

  it('agrupa as mídias por seção, para a lista não fazer N+1', () => {
    const medias = [
      { id: 'm1', targetId: 'a' },
      { id: 'm2', targetId: 'b' },
      { id: 'm3', targetId: 'a' },
    ] as unknown as MediaItemEntity[];

    const grupos = groupMediasBySection(medias);

    expect(grupos.get('a')?.map((m) => m.id)).toEqual(['m1', 'm3']);
    expect(grupos.get('b')?.map((m) => m.id)).toEqual(['m2']);
  });
});
