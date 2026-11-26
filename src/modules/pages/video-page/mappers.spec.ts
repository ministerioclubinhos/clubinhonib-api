import { AppNotFoundException } from 'src/shared/exceptions';
import { RouteType } from 'src/modules/routes/route-page.entity';
import {
  MediaItemEntity,
  MediaType,
  PlatformType,
  UploadType,
} from 'src/shared/media/media-item/media-item.entity';
import { VideosPage } from './entities/video-page.entity';
import { hasRoute, toVideosPageResponse } from './mappers';

const page = (overrides: Partial<VideosPage> = {}): VideosPage =>
  Object.assign(new VideosPage(), {
    id: 'page-id',
    name: 'Galeria de vídeos',
    description: 'Descrição',
    public: true,
    createdAt: new Date(),
    updatedAt: new Date(),
    route: {
      id: 'route-id',
      title: 'Galeria de vídeos',
      subtitle: 'Página de galeria de vídeos',
      public: true,
      image: 'https://example.com/card.png',
      idToFetch: 'page-id',
      path: 'galeria_videos_galeria',
      entityType: 'VideosPage',
      description: 'Descrição',
      entityId: 'page-id',
      type: RouteType.PAGE,
    },
    ...overrides,
  });

const video = (): MediaItemEntity =>
  Object.assign(new MediaItemEntity(), {
    id: 'video-id',
    title: 'Vídeo',
    description: 'Descrição',
    mediaType: MediaType.VIDEO,
    uploadType: UploadType.LINK,
    platformType: PlatformType.YOUTUBE,
    url: 'https://youtube.com/embed/a',
    isLocalFile: false,
    originalName: '',
    size: 0,
    targetId: 'page-id',
    targetType: 'VideosPage',
  });

describe('video page mappers', () => {
  it('expõe apenas os campos do contrato, sem colunas internas', () => {
    // A resposta antiga devolvia a entidade inteira, incluindo targetId
    // e targetType.
    const response = toVideosPageResponse(page(), [video()]);

    expect(Object.keys(response.videos[0]).sort()).toEqual([
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
    ]);
  });

  it('mapeia os campos da página', () => {
    const response = toVideosPageResponse(page(), []);

    expect(response).toMatchObject({
      id: 'page-id',
      title: 'Galeria de vídeos',
      public: true,
    });
    expect(response.videos).toEqual([]);
  });

  it('falha com erro nomeado quando a página está sem rota', () => {
    const orphan = page({ route: undefined as never });

    expect(hasRoute(orphan)).toBe(false);
    expect(() => toVideosPageResponse(orphan)).toThrow(AppNotFoundException);
  });
});
