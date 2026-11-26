import { Injectable } from '@nestjs/common';
import { DataSource, In, Repository } from 'typeorm';
import { UserPreferences } from '../entities/user-preferences.entity';

@Injectable()
export class UserPreferencesRepository extends Repository<UserPreferences> {
  constructor(private dataSource: DataSource) {
    super(UserPreferences, dataSource.createEntityManager());
  }

  async findByUserId(userId: string): Promise<UserPreferences | null> {
    return this.findOne({ where: { userId } });
  }

  /** Preferências de vários usuários de uma vez. */
  async findByUserIds(userIds: string[]): Promise<UserPreferences[]> {
    if (!userIds.length) return [];
    return this.find({ where: { userId: In(userIds) } });
  }

  async createForUser(
    userId: string,
    data: Partial<UserPreferences>,
  ): Promise<UserPreferences> {
    const { userId: _ignoredUserId, ...cleanData } = data;
    void _ignoredUserId;
    const preferences = this.create({
      ...cleanData,
      userId,
    });
    return this.save(preferences);
  }

  async updateByUserId(
    userId: string,
    data: Partial<UserPreferences>,
  ): Promise<UserPreferences | null> {
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
