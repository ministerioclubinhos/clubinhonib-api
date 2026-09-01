import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, Repository } from 'typeorm';
import { WeekMaterialsPageEntity } from '../entities/week-material-page.entity';
import { WEEK_MATERIAL_PAGE_RELATIONS } from '../constants';
import { WeekMaterialPageContent } from '../types';

@Injectable()
export class WeekMaterialsPageRepository {
  constructor(
    @InjectRepository(WeekMaterialsPageEntity)
    private readonly pageRepo: Repository<WeekMaterialsPageEntity>,
  ) {}

  private scoped(manager?: EntityManager): Repository<WeekMaterialsPageEntity> {
    return manager
      ? manager.getRepository(WeekMaterialsPageEntity)
      : this.pageRepo;
  }

  async findAllPages(): Promise<WeekMaterialsPageEntity[]> {
    return this.pageRepo.find({
      relations: [...WEEK_MATERIAL_PAGE_RELATIONS],
      order: { createdAt: 'DESC' },
    });
  }

  async findOnePageById(
    id: string,
    manager?: EntityManager,
  ): Promise<WeekMaterialsPageEntity | null> {
    return this.scoped(manager).findOne({
      where: { id },
      relations: [...WEEK_MATERIAL_PAGE_RELATIONS],
    });
  }

  async findCurrentWeek(
    manager?: EntityManager,
  ): Promise<WeekMaterialsPageEntity | null> {
    return this.scoped(manager).findOne({
      where: { currentWeek: true },
      relations: [...WEEK_MATERIAL_PAGE_RELATIONS],
    });
  }

  async createPage(
    content: Pick<
      WeekMaterialPageContent,
      'title' | 'subtitle' | 'description'
    > &
      Partial<Pick<WeekMaterialPageContent, 'currentWeek'>>,
    manager?: EntityManager,
  ): Promise<WeekMaterialsPageEntity> {
    const repository = this.scoped(manager);
    const page = repository.create(content);
    return repository.save(page);
  }

  async savePage(
    page: WeekMaterialsPageEntity,
    manager?: EntityManager,
  ): Promise<WeekMaterialsPageEntity> {
    return this.scoped(manager).save(page);
  }

  async removePage(
    page: WeekMaterialsPageEntity,
    manager?: EntityManager,
  ): Promise<void> {
    await this.scoped(manager).remove(page);
  }
}
