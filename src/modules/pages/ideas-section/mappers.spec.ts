import { IdeasSectionEntity } from 'src/modules/pages/ideas-page/entities/ideas-section.entity';
import { MediaItemEntity } from 'src/shared/media/media-item/media-item.entity';

import { groupMediasBySection, toIdeasSectionResponse } from './mappers';

/**
 * Trava o formato da resposta de ideias compartilhadas.
 *
 * O front declara os mesmos campos em `src/features/ideas-sections/types.ts`.
 */
describe('toIdeasSectionResponse (contrato de resposta)', () => {
  const section = {
    id: 'section-1',
    title: 'Brincadeira dos balões',
    description: 'Ideia para o clubinho de sábado',
    public: false,
    page: null,
    createdAt: new Date('2026-03-01T10:00:00Z'),
    updatedAt: new Date('2026-03-02T10:00:00Z'),
  } as unknown as IdeasSectionEntity;

  it('expõe exatamente os campos do contrato', () => {
    expect(Object.keys(toIdeasSectionResponse(section)).sort()).toEqual(
      [
        'createdAt',
        'description',
        'id',
        'medias',
        'pageId',
        'public',
        'title',
        'updatedAt',
      ].sort(),
    );
  });

  it('diz em qual página a ideia foi publicada', () => {
    // `pageId` nulo é o que distingue a ideia pendente da já publicada.
    expect(toIdeasSectionResponse(section).pageId).toBeNull();

    const publicada = {
      ...section,
      page: { id: 'page-1' },
    } as unknown as IdeasSectionEntity;

    expect(toIdeasSectionResponse(publicada).pageId).toBe('page-1');
  });

  it('entrega a mídia no recorte do contrato, sem a entidade inteira', () => {
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
      size: 1024,
      targetId: 'section-1',
      targetType: 'IdeasSection',
    } as unknown as MediaItemEntity;

    const response = toIdeasSectionResponse(section, [media]);

    expect(Object.keys(response.medias[0]).sort()).toEqual(
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
    expect(response.medias[0]).not.toHaveProperty('targetId');
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
    expect(grupos.get('inexistente')).toBeUndefined();
  });
});
