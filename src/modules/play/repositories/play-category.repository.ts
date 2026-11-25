import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, Repository } from 'typeorm';
import { PlayCategoryEntity } from '../entities/play-category.entity';

@Injectable()
export class PlayCategoryRepository {
  constructor(
    @InjectRepository(PlayCategoryEntity)
    private readonly repo: Repository<PlayCategoryEntity>,
  ) {}

  private scoped(manager?: EntityManager): Repository<PlayCategoryEntity> {
    return manager ? manager.getRepository(PlayCategoryEntity) : this.repo;
  }

  findById(id: string, manager?: EntityManager) {
    return this.scoped(manager).findOne({ where: { id } });
  }

  findBySlug(slug: string) {
    return this.repo.findOne({ where: { slug } });
  }

  async nextPosition(): Promise<number> {
    const row = await this.repo
      .createQueryBuilder('cat')
      .select('MAX(cat.position)', 'max')
      .getRawOne<{ max: number | null }>();
    return (row?.max ?? -1) + 1;
  }

  save(category: Partial<PlayCategoryEntity>) {
    return this.repo.save(this.repo.create(category));
  }

  async remove(category: PlayCategoryEntity): Promise<void> {
    await this.repo.remove(category);
  }
}
