import { Injectable } from '@nestjs/common';
import { DataSource, Repository } from 'typeorm';
import { PersonalData } from '../entities/personal-data.entity';

@Injectable()
export class PersonalDataRepository extends Repository<PersonalData> {
  constructor(private dataSource: DataSource) {
    super(PersonalData, dataSource.createEntityManager());
  }

  async findByUserId(userId: string): Promise<PersonalData | null> {
    return this.findOne({ where: { userId } });
  }

  async createForUser(userId: string, data: Partial<PersonalData>): Promise<PersonalData> {
    const { userId: _, ...cleanData } = data;
    const personalData = this.create({
      ...cleanData,
      userId,
    });
    return this.save(personalData);
  }

  async updateByUserId(userId: string, data: Partial<PersonalData>): Promise<PersonalData | null> {
    if (!data || Object.keys(data).length === 0) {
      return this.findByUserId(userId);
    }
    await this.update({ userId }, data);
    return this.findByUserId(userId);
  }

  async deleteByUserId(userId: string): Promise<void> {
    await this.delete({ userId });
  }
}
