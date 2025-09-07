import { AcceptedChristEntity } from '../entities/accepted-christ.entity';
import { DataSource, Repository } from 'typeorm';
import { Injectable } from '@nestjs/common';

@Injectable()
export class AcceptedChristRepository extends Repository<AcceptedChristEntity> {
  constructor(private readonly dataSource: DataSource) {
    super(AcceptedChristEntity, dataSource.createEntityManager());
  }
}
