import { Injectable, NotFoundException, ConflictException, Logger } from '@nestjs/common';
import { FeatureFlagsRepository } from './feature-flags.repository';
import { CreateFeatureFlagDto } from './dto/create-feature-flag.dto';
import { UpdateFeatureFlagDto } from './dto/update-feature-flag.dto';
import { FeatureFlagEntity } from './entities/feature-flag.entity';

@Injectable()
export class FeatureFlagsService {
    private readonly logger = new Logger(FeatureFlagsService.name);
    private readonly cache = new Map<string, { enabled: boolean; timestamp: number }>();
    private readonly CACHE_TTL = 60000;

    constructor(private readonly repository: FeatureFlagsRepository) { }

    async create(dto: CreateFeatureFlagDto): Promise<FeatureFlagEntity> {
        const existing = await this.repository.findByKey(dto.key);
        if (existing) {
            throw new ConflictException(`Feature flag with key "${dto.key}" already exists`);
        }

        const flag = this.repository.create(dto);
        const saved = await this.repository.save(flag);
        this.invalidateCache(dto.key);
        return saved;
    }

    async findAll(): Promise<FeatureFlagEntity[]> {
        return this.repository.find({ order: { createdAt: 'DESC' } });
    }

    async findByKey(key: string): Promise<FeatureFlagEntity> {
        const flag = await this.repository.findByKey(key);
        if (!flag) {
            throw new NotFoundException(`Feature flag with key "${key}" not found`);
        }
        return flag;
    }

    async findByEnvironment(environment: string): Promise<FeatureFlagEntity[]> {
        return this.repository.findByEnvironment(environment);
    }

    async update(key: string, dto: UpdateFeatureFlagDto): Promise<FeatureFlagEntity> {
        const flag = await this.findByKey(key);
        Object.assign(flag, dto);
        const updated = await this.repository.save(flag);
        this.invalidateCache(key);
        return updated;
    }

    async remove(key: string): Promise<void> {
        const flag = await this.findByKey(key);
        await this.repository.remove(flag);
        this.invalidateCache(key);
    }

    async toggle(key: string): Promise<FeatureFlagEntity> {
        const flag = await this.repository.toggleFlag(key);
        this.invalidateCache(key);
        return flag;
    }

    async isEnabled(key: string, environment?: string): Promise<boolean> {
        const cacheKey = environment ? `${key}:${environment}` : key;
        const cached = this.cache.get(cacheKey);

        if (cached && Date.now() - cached.timestamp < this.CACHE_TTL) {
            return cached.enabled;
        }

        const enabled = await this.repository.isEnabled(key, environment);
        this.cache.set(cacheKey, { enabled, timestamp: Date.now() });
        return enabled;
    }

    private invalidateCache(key: string): void {
        const keysToDelete = Array.from(this.cache.keys()).filter(k => k.startsWith(key));
        keysToDelete.forEach(k => this.cache.delete(k));
    }
}
