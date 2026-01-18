import { Injectable } from '@nestjs/common';
import { DataSource, Repository } from 'typeorm';
import { FeatureFlagEntity } from './entities/feature-flag.entity';

@Injectable()
export class FeatureFlagsRepository extends Repository<FeatureFlagEntity> {
    constructor(private dataSource: DataSource) {
        super(FeatureFlagEntity, dataSource.createEntityManager());
    }

    async findByKey(key: string): Promise<FeatureFlagEntity | null> {
        return this.findOne({ where: { key } });
    }

    async findByEnvironment(environment: string): Promise<FeatureFlagEntity[]> {
        return this.find({ where: { environment } });
    }

    async isEnabled(key: string, environment?: string): Promise<boolean> {
        const query = this.createQueryBuilder('ff')
            .where('ff.key = :key', { key })
            .andWhere('ff.enabled = :enabled', { enabled: true });

        if (environment) {
            query.andWhere('(ff.environment = :environment OR ff.environment IS NULL)', { environment });
        }

        const flag = await query.getOne();
        return !!flag;
    }

    async toggleFlag(key: string): Promise<FeatureFlagEntity> {
        const flag = await this.findByKey(key);
        if (!flag) {
            throw new Error(`Feature flag with key "${key}" not found`);
        }

        flag.enabled = !flag.enabled;
        return this.save(flag);
    }
}
