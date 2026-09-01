import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, FindOptionsWhere, In, Repository } from 'typeorm';
import { ImagePageEntity } from '../entity/Image-page.entity';
import { ImageSectionEntity } from '../entity/Image-section.entity';
import { IMAGE_PAGE_RELATIONS } from '../constants';
import { ImagePageContent } from '../types';

@Injectable()
export class ImagePageRepository {
  constructor(
    @InjectRepository(ImagePageEntity)
    private readonly pageRepo: Repository<ImagePageEntity>,
    @InjectRepository(ImageSectionEntity)
    private readonly sectionRepo: Repository<ImageSectionEntity>,
  ) {}

  private scoped(manager?: EntityManager): Repository<ImagePageEntity> {
    return manager ? manager.getRepository(ImagePageEntity) : this.pageRepo;
  }

  private scopedSections(
    manager?: EntityManager,
  ): Repository<ImageSectionEntity> {
    return manager
      ? manager.getRepository(ImageSectionEntity)
      : this.sectionRepo;
  }

  async findAllWithSections(): Promise<ImagePageEntity[]> {
    return this.pageRepo.find({
      relations: [...IMAGE_PAGE_RELATIONS],
      order: { createdAt: 'DESC' },
    });
  }

  async findByIdWithSections(
    id: string,
    manager?: EntityManager,
  ): Promise<ImagePageEntity | null> {
    return this.scoped(manager).findOne({
      where: { id },
      relations: [...IMAGE_PAGE_RELATIONS],
    });
  }

  async findById(
    id: string,
    manager?: EntityManager,
  ): Promise<ImagePageEntity | null> {
    return this.scoped(manager).findOne({ where: { id } });
  }

  async createPage(
    content: ImagePageContent,
    manager?: EntityManager,
  ): Promise<ImagePageEntity> {
    const repository = this.scoped(manager);
    return repository.save(repository.create(content));
  }

  async savePage(
    page: ImagePageEntity,
    manager?: EntityManager,
  ): Promise<ImagePageEntity> {
    return this.scoped(manager).save(page);
  }

  async removePage(
    page: ImagePageEntity,
    manager?: EntityManager,
  ): Promise<void> {
    await this.scoped(manager).remove(page);
  }

  // --- seções -------------------------------------------------------------

  async findSectionsOfPage(
    pageId: string,
    manager?: EntityManager,
  ): Promise<ImageSectionEntity[]> {
    return this.scopedSections(manager).find({
      where: { page: { id: pageId } },
    });
  }

  /**
   * Página de seções de uma galeria. `includePrivate` decide se as seções
   * privadas entram no resultado — quem sabe disso é o caso de uso, não o
   * repositório.
   */
  async findSectionsPaginated(
    pageId: string,
    offset: number,
    limit: number,
    includePrivate: boolean,
  ): Promise<[ImageSectionEntity[], number]> {
    const where: FindOptionsWhere<ImageSectionEntity> = {
      page: { id: pageId },
      ...(includePrivate ? {} : { public: true }),
    };

    return this.sectionRepo.findAndCount({
      where,
      order: { createdAt: 'DESC' },
      skip: offset,
      take: limit,
    });
  }

  async createSection(
    page: ImagePageEntity,
    section: Pick<ImageSectionEntity, 'caption' | 'description' | 'public'>,
    manager?: EntityManager,
  ): Promise<ImageSectionEntity> {
    const repository = this.scopedSections(manager);
    return repository.save(repository.create({ ...section, page }));
  }

  async saveSection(
    section: ImageSectionEntity,
    manager?: EntityManager,
  ): Promise<ImageSectionEntity> {
    return this.scopedSections(manager).save(section);
  }

  async findSectionById(
    id: string,
    manager?: EntityManager,
  ): Promise<ImageSectionEntity | null> {
    return this.scopedSections(manager).findOne({ where: { id } });
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
