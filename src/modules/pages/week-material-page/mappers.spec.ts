import { RouteType } from 'src/modules/routes/route-page.entity';
import {
  MediaItemEntity,
  MediaType,
  PlatformType,
  UploadType,
} from 'src/shared/media/media-item/media-item.entity';
import { WeekMaterialsPageEntity } from './entities/week-material-page.entity';
import { AppNotFoundException, ErrorCode } from 'src/shared/exceptions';
import { hasRoute, toWeekMaterialsPageResponse } from './mappers';

const page = (): WeekMaterialsPageEntity =>
  Object.assign(new WeekMaterialsPageEntity(), {
    id: 'page-id',
    title: 'Semana 1',
    subtitle: 'Tema',
    description: 'Descrição',
    currentWeek: true,
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-02T00:00:00.000Z'),
    route: {
      id: 'route-id',
      path: 'materiais_semanal_semana_1',
      title: 'Semana 1',
      subtitle: 'Tema',
      description: 'Descrição',
      type: RouteType.PAGE,
      public: true,
      current: true,
      image: 'https://example.com/card.png',
      idToFetch: 'page-id',
      entityType: 'WeekMaterialsPage',
      entityId: 'page-id',
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  });

const media = (id: string, mediaType: MediaType): MediaItemEntity =>
  Object.assign(new MediaItemEntity(), {
    id,
    title: `t-${id}`,
    description: `d-${id}`,
    mediaType,
    uploadType: UploadType.LINK,
    platformType: PlatformType.YOUTUBE,
    url: `https://example.com/${id}`,
    isLocalFile: false,
    size: 0,
    originalName: '',
    targetId: 'page-id',
    targetType: 'WeekMaterialsPage',
  });

describe('toWeekMaterialsPageResponse', () => {
  it('exposes only the documented page and route fields', () => {
    const response = toWeekMaterialsPageResponse(page());

    expect(response).toMatchObject({
      id: 'page-id',
      title: 'Semana 1',
      currentWeek: true,
    });
    expect(Object.keys(response.route).sort()).toEqual([
      'description',
      'id',
      'path',
      'public',
      'subtitle',
      'title',
      'type',
    ]);
  });

  it('splits media items into their contract groups', () => {
    const response = toWeekMaterialsPageResponse(page(), [
      media('v1', MediaType.VIDEO),
      media('d1', MediaType.DOCUMENT),
      media('i1', MediaType.IMAGE),
      media('a1', MediaType.AUDIO),
    ]);

    expect(response.videos.map((i) => i.id)).toEqual(['v1']);
    expect(response.documents.map((i) => i.id)).toEqual(['d1']);
    expect(response.images.map((i) => i.id)).toEqual(['i1']);
    expect(response.audios.map((i) => i.id)).toEqual(['a1']);
  });

  it('falha com erro nomeado quando a página está sem rota', () => {
    const orphan = page();
    orphan.route = undefined as never;

    expect(hasRoute(orphan)).toBe(false);
    expect(() => toWeekMaterialsPageResponse(orphan)).toThrow(
      AppNotFoundException,
    );
    try {
      toWeekMaterialsPageResponse(orphan);
    } catch (error) {
      expect((error as AppNotFoundException).getCode()).toBe(
        ErrorCode.ROUTE_NOT_FOUND,
      );
    }
  });

  it('returns empty media groups when the page has no media', () => {
    const response = toWeekMaterialsPageResponse(page(), []);

    expect(response.videos).toEqual([]);
    expect(response.documents).toEqual([]);
    expect(response.images).toEqual([]);
    expect(response.audios).toEqual([]);
  });
});
