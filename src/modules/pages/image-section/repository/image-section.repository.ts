import { Injectable } from '@nestjs/common';
import {
  DataSource,
  DeepPartial,
  EntityManager,
  IsNull,
  Repository,
} from 'typeorm';
import { ImageSectionEntity } from '../../image-page/entity/Image-section.entity';
import { AppNotFoundException, ErrorCode } from 'src/shared/exceptions';

@Injectable()
export class ImageSectionRepository extends Repository<ImageSectionEntity> {
  constructor(private readonly dataSource: DataSource) {
    super(ImageSectionEntity, dataSource.createEntityManager());
  }

  /**
   * Roda um conjunto de escritas numa transação só.
   *
   * Abrir e fechar transação é acesso ao banco, e mora aqui. O caso de uso
   * continua decidindo o que é atômico, mas não conhece `QueryRunner`, commit
   * nem rollback.
   */
  async runInTransaction<T>(
    work: (manager: EntityManager) => Promise<T>,
  ): Promise<T> {
    return this.dataSource.transaction(work);
  }

  /** Cria a seção dentro da transação em curso. */
  async createInTransaction(
    manager: EntityManager,
    data: DeepPartial<ImageSectionEntity>,
  ): Promise<ImageSectionEntity> {
    const repo = manager.getRepository(ImageSectionEntity);

    return repo.save(repo.create(data));
  }

  /** Grava a seção como está. */
  async saveInTransaction(
    manager: EntityManager,
    section: ImageSectionEntity,
  ): Promise<ImageSectionEntity> {
    return manager.save(ImageSectionEntity, section);
  }

  /** Remove a seção dentro da transação em curso. */
  async removeInTransaction(
    manager: EntityManager,
    section: ImageSectionEntity,
  ): Promise<void> {
    await manager.remove(section);
  }

  /** Uma seção pelo id, ou `null` quando não existe. */
  async findById(id: string): Promise<ImageSectionEntity | null> {
    return this.findOneBy({ id });
  }

  async findByPageId(pageId: string): Promise<ImageSectionEntity[]> {
    return this.find({
      where: { page: { id: pageId } },
      relations: ['page'],
    });
  }

  async findAllOrphanSections(): Promise<ImageSectionEntity[]> {
    return this.find({
      where: { page: IsNull() },
    });
  }

  async upsertSection(
    sectionData: Partial<ImageSectionEntity>,
  ): Promise<ImageSectionEntity> {
    if (sectionData.id) {
      const existing = await this.findOne({ where: { id: sectionData.id } });

      if (!existing) {
        throw new AppNotFoundException(
          ErrorCode.RESOURCE_NOT_FOUND,
          `Seção com ID=${sectionData.id} não encontrada.`,
        );
      }

      const merged = this.merge(existing, sectionData);
      return this.save(merged);
    }

    const created = this.create(sectionData);
    return this.save(created);
  }

  async findAllOrfaSections(): Promise<ImageSectionEntity[]> {
    return this.find({
      where: { page: IsNull() },
    });
  }
}
