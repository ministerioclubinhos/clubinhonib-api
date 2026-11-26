import { DataSource, Repository, SelectQueryBuilder } from 'typeorm';

import { IdeasSectionEntity } from 'src/modules/pages/ideas-page/entities/ideas-section.entity';

import { IdeasSectionsRepository } from './ideas-sections.repository';
import {
  IdeaAiEnhancementStatus,
  IdeaAiQueueFilter,
} from '../../ideas-section-ai/enums/ideas-section-ai.enums';

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

  describe('filtro da fila pelo estado da IA', () => {
    const build = () => {
      const andWheres: Array<[string, Record<string, unknown> | undefined]> =
        [];
      const chain: Record<string, unknown> = {};
      const self = (): Record<string, unknown> => chain;
      chain.leftJoinAndSelect = jest.fn(self);
      chain.where = jest.fn(self);
      chain.andWhere = jest.fn(
        (clause: string, params?: Record<string, unknown>) => {
          andWheres.push([clause, params]);
          return chain;
        },
      );
      chain.orderBy = jest.fn(self);
      chain.skip = jest.fn(self);
      chain.take = jest.fn(self);
      chain.getManyAndCount = jest.fn(() => Promise.resolve([[], 0] as const));
      const sub: Record<string, unknown> = {};
      let subWhere = '';
      sub.select = jest.fn(() => sub);
      sub.from = jest.fn(() => sub);
      sub.where = jest.fn((clause: string) => {
        subWhere = clause;
        return sub;
      });
      sub.getQuery = jest.fn(() => `(SUB ${subWhere})`);
      chain.subQuery = jest.fn(() => sub);
      const repo = new IdeasSectionsRepository(
        {} as unknown as DataSource,
        {
          createQueryBuilder: () =>
            chain as unknown as SelectQueryBuilder<IdeasSectionEntity>,
        } as unknown as Repository<IdeasSectionEntity>,
      );
      return { repo, andWheres };
    };

    it.each([
      [IdeaAiQueueFilter.NONE, ['NOT EXISTS (SUB any.sectionId = section.id)']],
      [
        IdeaAiQueueFilter.PROCESSING,
        ['EXISTS (SUB active.activeSectionId = section.id)'],
      ],
      [
        IdeaAiQueueFilter.READY,
        [
          'EXISTS (SUB result.currentResultSectionId = section.id)',
          'NOT EXISTS (SUB active.activeSectionId = section.id)',
        ],
      ],
    ])('%s', async (aiStatus, expected) => {
      const { repo, andWheres } = build();
      await repo.findPendingPaginated({ aiStatus });
      expect(andWheres.map(([clause]) => clause)).toEqual(expected);
    });

    it('FAILED compara com a última tentativa', async () => {
      const { repo, andWheres } = build();
      await repo.findPendingPaginated({ aiStatus: IdeaAiQueueFilter.FAILED });
      expect(andWheres).toHaveLength(1);
      expect(andWheres[0][0]).toContain('failed.status = :aiFailed');
      expect(andWheres[0][0]).toContain('failed.attempt = (SUB');
      expect(andWheres[0][1]).toEqual({
        aiFailed: IdeaAiEnhancementStatus.FAILED,
      });
    });
  });
});
