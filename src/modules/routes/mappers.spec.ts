import { RouteEntity, RouteType } from './route-page.entity';
import { toRouteResponse, toRouteResponseList } from './mappers';

const buildRoute = (extra: Partial<RouteEntity> = {}): RouteEntity =>
  Object.assign(new RouteEntity(), {
    id: 'route-id',
    title: 'Galeria',
    subtitle: 'fotos',
    description: 'as fotos do clubinho',
    path: 'galeria_fotos',
    public: true,
    current: true,
    image: 'https://bucket/capa.jpg',
    idToFetch: 'page-id',
    entityId: 'page-id',
    entityType: 'ImagesPage',
    type: RouteType.PAGE,
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-02-01T00:00:00.000Z'),
    ...extra,
  });

describe('toRouteResponse', () => {
  it('devolve exatamente os campos do contrato', () => {
    // `/routes` é pública: o site monta o mapa antes de qualquer login. Este
    // teste é o que impede uma coluna nova na entidade de vazar sozinha — se
    // alguém trocar o DTO pela entidade crua de novo, ele reprova.
    expect(Object.keys(toRouteResponse(buildRoute())).sort()).toEqual([
      'createdAt',
      'current',
      'description',
      'entityId',
      'entityType',
      'id',
      'idToFetch',
      'image',
      'path',
      'public',
      'subtitle',
      'title',
      'type',
      'updatedAt',
    ]);
  });

  it('copia os valores da entidade', () => {
    expect(toRouteResponse(buildRoute())).toEqual({
      id: 'route-id',
      title: 'Galeria',
      subtitle: 'fotos',
      description: 'as fotos do clubinho',
      path: 'galeria_fotos',
      public: true,
      current: true,
      image: 'https://bucket/capa.jpg',
      idToFetch: 'page-id',
      entityId: 'page-id',
      entityType: 'ImagesPage',
      type: RouteType.PAGE,
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-02-01T00:00:00.000Z',
    });
  });

  it('normaliza o que a coluna deixa nulo', () => {
    // O site espera sempre booleano em `current` e aceita `null` em `image`.
    const resposta = toRouteResponse(
      buildRoute({ current: undefined, image: null as unknown as string }),
    );

    expect(resposta.current).toBe(false);
    expect(resposta.image).toBeNull();
  });

  it('aceita a data já em texto, como vem de consulta raw', () => {
    const resposta = toRouteResponse(
      buildRoute({
        createdAt: '2026-01-01T00:00:00.000Z' as unknown as Date,
      }),
    );

    expect(resposta.createdAt).toBe('2026-01-01T00:00:00.000Z');
  });

  it('mapeia a lista preservando a ordem', () => {
    const lista = toRouteResponseList([
      buildRoute({ id: 'a' }),
      buildRoute({ id: 'b' }),
    ]);

    expect(lista.map((r) => r.id)).toEqual(['a', 'b']);
  });
});
