import { Injectable } from '@nestjs/common';
import { DataSource, EntityManager, Repository } from 'typeorm';

import { ChildEntity } from 'src/modules/children/entities/child.entity';

import { AcceptedChristEntity } from '../entities/accepted-christ.entity';
import { DecisionType } from '../enums/decision-type.enum';

import {
  recordAuthorRef,
  recordAuthorSelection,
} from 'src/shared/record-author/record-author.util';

@Injectable()
export class AcceptedChristRepository extends Repository<AcceptedChristEntity> {
  constructor(private readonly dataSource: DataSource) {
    super(AcceptedChristEntity, dataSource.createEntityManager());
  }

  /**
   * Grava a decisão de uma criança.
   *
   * O vínculo vai só pelo id: quem já validou o acesso à criança é o caso de
   * uso, e carregar a entidade inteira de novo aqui seria uma consulta a mais
   * pelo mesmo dado.
   */
  async createForChild(data: {
    childId: string;
    decision: DecisionType | null;
    notes: string | null;
    createdByUserId: string | null;
  }): Promise<AcceptedChristEntity> {
    const entity = this.create({
      decision: data.decision,
      notes: data.notes,
      child: { id: data.childId } as ChildEntity,
      createdBy: recordAuthorRef(data.createdByUserId),
    });

    // Registrar uma decisão é uma alteração na criança: decisão e autoria da
    // alteração são gravadas juntas, ou nenhuma das duas.
    const saved = await this.dataSource.transaction(async (manager) => {
      const row = await manager.save(entity);
      await this.touchChild(manager, data.childId, data.createdByUserId);
      return row;
    });

    // A gravação leva só o id; a resposta precisa do nome de quem registrou.
    return this.createQueryBuilder('ac')
      .leftJoin('ac.createdBy', 'createdBy')
      .addSelect(recordAuthorSelection('createdBy'))
      .where('ac.id = :id', { id: saved.id })
      .getOneOrFail();
  }

  /** Tipos das decisões já registradas para a criança. */
  async findDecisionsOfChild(
    childId: string,
  ): Promise<{ id: string; decision: DecisionType | null }[]> {
    const rows = await this.createQueryBuilder('ac')
      .select(['ac.id', 'ac.decision'])
      .where('ac.child_id = :childId', { childId })
      .getMany();

    return rows.map((row) => ({ id: row.id, decision: row.decision }));
  }

  /** A decisão com o id da criança, para conferir o alcance de quem pede. */
  async findByIdWithChild(id: string): Promise<AcceptedChristEntity | null> {
    return this.createQueryBuilder('ac')
      .innerJoin('ac.child', 'child')
      .select(['ac.id', 'ac.decision', 'child.id'])
      .where('ac.id = :id', { id })
      .getOne();
  }

  /** Exclui a decisão e registra quem alterou a criança, na mesma transação. */
  async deleteForChild(data: {
    id: string;
    childId: string;
    updatedByUserId: string | null;
  }): Promise<void> {
    await this.dataSource.transaction(async (manager) => {
      await manager.delete(AcceptedChristEntity, data.id);
      await this.touchChild(manager, data.childId, data.updatedByUserId);
    });
  }

  /**
   * Marca a criança como alterada por `userId`.
   *
   * O `updatedAt` acompanha sozinho: a coluna é de atualização automática.
   */
  private async touchChild(
    manager: EntityManager,
    childId: string,
    userId: string | null,
  ): Promise<void> {
    await manager.update(ChildEntity, childId, {
      updatedBy: recordAuthorRef(userId),
    });
  }
}
