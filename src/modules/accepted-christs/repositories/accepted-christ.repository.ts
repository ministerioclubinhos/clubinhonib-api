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
}
