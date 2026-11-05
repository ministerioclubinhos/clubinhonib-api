import { Repository, SelectQueryBuilder } from 'typeorm';

import { ImageSectionEntity } from 'src/modules/pages/image-page/entity/Image-section.entity';

import { ImageSectionsRepository } from './image-sections.repository';

/** O que o construtor de consulta falso registra. */
interface RecordedClauses {
  where: string[];
  andWhere: string[];
}

/**
 * Construtor de consulta falso que registra as cláusulas recebidas.
 *
 * A coluna da FK se chama `pageId`; filtrar por `section.page_id` derrubava a
 * fila e a contagem com erro interno. O filtro precisa passar pelo alias da
 * página juntada, que independe do nome da coluna.
 */
function fakeQueryBuilder(): {
  qb: SelectQueryBuilder<ImageSectionEntity>;
  calls: RecordedClauses;
} {
  const calls: RecordedClauses = { where: [], andWhere: [] };
  const chain: Record<string, unknown> = {};
  const self = (): Record<string, unknown> => chain;

  chain.leftJoinAndSelect = jest.fn(self);
  chain.leftJoin = jest.fn(self);
  chain.addSelect = jest.fn(self);
  chain.where = jest.fn((clause: string) => {
    calls.where.push(clause);
    return chain;
  });
  chain.andWhere = jest.fn((clause: string) => {
    calls.andWhere.push(clause);
    return chain;
  });
  chain.orderBy = jest.fn(self);
  chain.skip = jest.fn(self);
  chain.take = jest.fn(self);
  chain.getManyAndCount = jest.fn(() =>
    Promise.resolve([[] as ImageSectionEntity[], 0] as const),
  );
  chain.getCount = jest.fn(() => Promise.resolve(0));

  return {
    qb: chain as unknown as SelectQueryBuilder<ImageSectionEntity>,
    calls,
  };
}

function repositoryWith(
  qb: SelectQueryBuilder<ImageSectionEntity>,
): ImageSectionsRepository {
  const typeormRepo = {
    createQueryBuilder: () => qb,
  } as unknown as Repository<ImageSectionEntity>;

  return new ImageSectionsRepository(typeormRepo);
}

describe('ImageSectionsRepository', () => {
  it('filtra aprovadas e pendentes pelo alias da página juntada', async () => {
    const { qb, calls } = fakeQueryBuilder();
    const repo = repositoryWith(qb);

    await repo.findAllPaginated({ approved: true });
    await repo.findAllPaginated({ approved: false });

    expect(calls.andWhere).toEqual([
      'page.id IS NOT NULL AND section.public = true',
      '(page.id IS NULL OR section.public = false)',
    ]);
    expect(calls.andWhere.join(' ')).not.toContain('page_id');
  });

  it('conta pendentes pelo alias da página juntada', async () => {
    const { qb, calls } = fakeQueryBuilder();
    const repo = repositoryWith(qb);

    await repo.countPending();

    expect(calls.where).toEqual([
      '(page.id IS NULL OR section.public = false)',
    ]);
  });
});
