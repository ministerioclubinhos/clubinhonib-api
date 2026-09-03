import { InformativeEntity } from './entities/informative.entity';
import { RouteEntity } from 'src/modules/routes/route-page.entity';
import { toInformativeResponse } from './mappers';

function buildInformative(
  overrides: Partial<InformativeEntity> = {},
): InformativeEntity {
  return {
    id: 'informative-1',
    title: 'Retiro de julho',
    description: 'Inscrições abertas.',
    public: true,
    route: { path: 'informativo_retiro_de_julho' } as RouteEntity,
    createdAt: new Date('2026-01-10T12:00:00.000Z'),
    updatedAt: new Date('2026-01-11T12:00:00.000Z'),
    ...overrides,
  } as InformativeEntity;
}

describe('informatives mappers', () => {
  it('expõe exatamente o contrato de InformativeResponseDto', () => {
    const response = toInformativeResponse(buildInformative());

    expect(Object.keys(response).sort()).toEqual([
      'createdAt',
      'description',
      'id',
      'public',
      'routePath',
      'title',
      'updatedAt',
    ]);
    expect(response.routePath).toBe('informativo_retiro_de_julho');
    expect(response.createdAt).toBe('2026-01-10T12:00:00.000Z');
  });

  it('devolve routePath nulo quando o informativo não tem rota', () => {
    const response = toInformativeResponse(buildInformative({ route: null }));

    expect(response.routePath).toBeNull();
  });

  it('não vaza a entidade de rota na resposta', () => {
    const response = toInformativeResponse(buildInformative());

    expect(response).not.toHaveProperty('route');
  });
});
