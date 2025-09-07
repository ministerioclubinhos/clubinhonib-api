import { Injectable } from '@nestjs/common';
import { AcceptedChristRepository } from '../repositories/accepted-christ.repository';
import { CreateAcceptedChristDto } from '../dtos/create-accepted-christ.dto';
import { ChildEntity } from 'src/modules/children/entities/child.entity';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AcceptedChristEntity } from '../entities/accepted-christ.entity';

@Injectable()
export class AcceptedChristService {
  constructor(
    private readonly acceptedChristRepository: AcceptedChristRepository,

    @InjectRepository(ChildEntity)
    private readonly childRepository: Repository<ChildEntity>,
  ) {}

  async create(dto: CreateAcceptedChristDto): Promise<AcceptedChristEntity> {
    const child = await this.childRepository.findOneByOrFail({ id: dto.childId });

    const accepted = this.acceptedChristRepository.create({
      decision: dto.decision ?? null,
      child,
      notes: dto.notes ?? null,
    });

    return await this.acceptedChristRepository.save(accepted);
  }
}
