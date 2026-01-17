import { Injectable } from '@nestjs/common';
import { DataSource, Repository } from 'typeorm';
import { SiteFeedbackEntity } from '../entity/site-feedback.entity';
import { CreateSiteFeedbackDto } from '../dto/create-site-feedback.dto';

@Injectable()
export class SiteFeedbackRepository extends Repository<SiteFeedbackEntity> {
  constructor(private readonly dataSource: DataSource) {
    super(SiteFeedbackEntity, dataSource.createEntityManager());
  }

  async createAndSave(dto: CreateSiteFeedbackDto): Promise<SiteFeedbackEntity> {
    const feedback = this.create(dto);
    return this.save(feedback);
  }

  async findAll(): Promise<SiteFeedbackEntity[]> {
    return this.find({ order: { createdAt: 'DESC' } });
  }

  async findById(id: string): Promise<SiteFeedbackEntity | null> {
    return this.findOneBy({ id });
  }

  async updateAndSave(entity: SiteFeedbackEntity, dto: CreateSiteFeedbackDto): Promise<SiteFeedbackEntity> {
    Object.assign(entity, dto);
    return this.save(entity);
  }

  async removeFeedback(entity: SiteFeedbackEntity): Promise<void> {
    await this.remove(entity);
  }
}