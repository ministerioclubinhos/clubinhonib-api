import { Injectable } from '@nestjs/common';
import { DataSource, Repository } from 'typeorm';

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

    const saved = await this.save(entity);

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

  async deleteById(id: string): Promise<void> {
    await this.delete(id);
  }
}
