import { Injectable } from '@nestjs/common';
import { DataSource, Repository } from 'typeorm';

import { ChildEntity } from 'src/modules/children/entities/child.entity';

import { AcceptedChristEntity } from '../entities/accepted-christ.entity';
import { DecisionType } from '../enums/decision-type.enum';

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
  }): Promise<AcceptedChristEntity> {
    const entity = this.create({
      decision: data.decision,
      notes: data.notes,
      child: { id: data.childId } as ChildEntity,
    });

    return this.save(entity);
  }

  /** Tipos das decisões já registradas para a criança. */
  async findDecisionsOfChild(
    childId: string,
  ): Promise<{ id: string; decision: DecisionType | null }[]> {
    return this.find({
      where: { child: { id: childId } },
      select: { id: true, decision: true },
    });
  }

  /** A decisão com o id da criança, para conferir o alcance de quem pede. */
  async findByIdWithChild(id: string): Promise<AcceptedChristEntity | null> {
    return this.findOne({
      where: { id },
      relations: { child: true },
      select: { id: true, decision: true, child: { id: true } },
    });
  }

  async deleteById(id: string): Promise<void> {
    await this.delete(id);
  }
}
