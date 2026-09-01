import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, In, Repository } from 'typeorm';
import { IdeasPageEntity } from '../entities/ideas-page.entity';
import { IdeasSectionEntity } from '../entities/ideas-section.entity';
import { IDEAS_PAGE_RELATIONS } from '../constants';
import { IdeasPageContent, IdeasSectionContent } from '../types';

@Injectable()
export class IdeasPageRepository {
  constructor(
    @InjectRepository(IdeasPageEntity)
    private readonly pageRepo: Repository<IdeasPageEntity>,
    @InjectRepository(IdeasSectionEntity)
    private readonly sectionRepo: Repository<IdeasSectionEntity>,
  ) {}

  private scoped(manager?: EntityManager): Repository<IdeasPageEntity> {
    return manager ? manager.getRepository(IdeasPageEntity) : this.pageRepo;
  }

  private scopedSections(
    manager?: EntityManager,
  ): Repository<IdeasSectionEntity> {
    return manager
      ? manager.getRepository(IdeasSectionEntity)
      : this.sectionRepo;
  }

  async findAllWithSections(): Promise<IdeasPageEntity[]> {
    return this.pageRepo.find({
      relations: [...IDEAS_PAGE_RELATIONS],
      order: { createdAt: 'DESC' },
    });
  }

  async findByIdWithSections(
    id: string,
    manager?: EntityManager,
  ): Promise<IdeasPageEntity | null> {
    return this.scoped(manager).findOne({
      where: { id },
      relations: [...IDEAS_PAGE_RELATIONS],
    });
  }

  async createPage(
    content: IdeasPageContent,
    manager?: EntityManager,
  ): Promise<IdeasPageEntity> {
    const repository = this.scoped(manager);
    return repository.save(repository.create(content));
  }

  async savePage(
    page: IdeasPageEntity,
    manager?: EntityManager,
  ): Promise<IdeasPageEntity> {
    return this.scoped(manager).save(page);
  }

  /**
   * Grava apenas as colunas da página. Evita `save()` no caminho de edição, que
   * arrastaria em cascata as seções carregadas com a entidade.
   */
  async updateContent(
    id: string,
    content: IdeasPageContent,
    manager?: EntityManager,
  ): Promise<void> {
    await this.scoped(manager).update(id, content);
  }

  async removePage(
    page: IdeasPageEntity,
    manager?: EntityManager,
  ): Promise<void> {
    await this.scoped(manager).remove(page);
  }

  // --- seções -------------------------------------------------------------

  async findSectionsOfPage(
    pageId: string,
    manager?: EntityManager,
  ): Promise<IdeasSectionEntity[]> {
    return this.scopedSections(manager).find({
      where: { page: { id: pageId } },
    });
  }

  async createSection(
    page: IdeasPageEntity,
    section: IdeasSectionContent,
    manager?: EntityManager,
  ): Promise<IdeasSectionEntity> {
    const repository = this.scopedSections(manager);
    return repository.save(repository.create({ ...section, page }));
  }

  async saveSection(
    section: IdeasSectionEntity,
    manager?: EntityManager,
  ): Promise<IdeasSectionEntity> {
    return this.scopedSections(manager).save(section);
  }

  async removeSectionsByIds(
    ids: string[],
    manager?: EntityManager,
  ): Promise<void> {
    if (ids.length === 0) return;
    const repository = this.scopedSections(manager);
    const sections = await repository.find({ where: { id: In(ids) } });
    if (sections.length > 0) await repository.remove(sections);
  }
}
