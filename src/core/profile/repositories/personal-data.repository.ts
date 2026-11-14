import { Injectable } from '@nestjs/common';
import { DataSource, In, Repository } from 'typeorm';
import { PersonalData } from '../entities/personal-data.entity';

@Injectable()
export class PersonalDataRepository extends Repository<PersonalData> {
  constructor(private dataSource: DataSource) {
    super(PersonalData, dataSource.createEntityManager());
  }

  async findByUserId(userId: string): Promise<PersonalData | null> {
    return this.findOne({ where: { userId } });
  }

  /**
   * Dados pessoais de vários usuários de uma vez.
   *
   * A listagem de perfis carregava um por um — duas consultas por linha da
   * página, além da consulta da própria página.
   */
  async findByUserIds(userIds: string[]): Promise<PersonalData[]> {
    if (!userIds.length) return [];
    return this.find({ where: { userId: In(userIds) } });
  }

  async createForUser(
    userId: string,
    data: Partial<PersonalData>,
  ): Promise<PersonalData> {
    const { userId: _ignoredUserId, ...cleanData } = data;
    void _ignoredUserId;
    const personalData = this.create({
      ...cleanData,
      userId,
    });
    return this.save(personalData);
  }

  async updateByUserId(
    userId: string,
    data: Partial<PersonalData>,
  ): Promise<PersonalData | null> {
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
