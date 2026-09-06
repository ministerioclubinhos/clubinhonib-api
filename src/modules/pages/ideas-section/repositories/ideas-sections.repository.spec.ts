import { DataSource, Repository, SelectQueryBuilder } from 'typeorm';

import { IdeasSectionEntity } from 'src/modules/pages/ideas-page/entities/ideas-section.entity';

import { IdeasSectionsRepository } from './ideas-sections.repository';

/**
 * A coluna da FK se chama `pageId`; filtrar por `section.page_id` derrubava a
 * fila de ideias com erro interno. O filtro precisa passar pelo alias da página
 * juntada, que independe do nome da coluna.
 */
describe('IdeasSectionsRepository', () => {
  it('lista pendentes pelo alias da página juntada', async () => {
    const whereClauses: string[] = [];
    const chain: Record<string, unknown> = {};
    const self = (): Record<string, unknown> => chain;

    chain.leftJoinAndSelect = jest.fn(self);
    chain.where = jest.fn((clause: string) => {
      whereClauses.push(clause);
      return chain;
    });
    chain.andWhere = jest.fn(self);
    chain.orderBy = jest.fn(self);
    chain.skip = jest.fn(self);
    chain.take = jest.fn(self);
    chain.getManyAndCount = jest.fn(() =>
      Promise.resolve([[] as IdeasSectionEntity[], 0] as const),
    );

    const typeormRepo = {
      createQueryBuilder: () =>
        chain as unknown as SelectQueryBuilder<IdeasSectionEntity>,
    } as unknown as Repository<IdeasSectionEntity>;
    const repo = new IdeasSectionsRepository(
      {} as unknown as DataSource,
      typeormRepo,
    );

    const result = await repo.findPendingPaginated({});

    expect(whereClauses).toEqual(['page.id IS NULL']);
    expect(result).toEqual({ items: [], total: 0 });
  });
});
