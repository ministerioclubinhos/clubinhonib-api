import { Injectable, NotFoundException } from '@nestjs/common';
import { DataSource, Repository, IsNull } from 'typeorm';
import { ImageSectionEntity } from '../../image-page/entity/Image-section.entity';

@Injectable()
export class ImageSectionRepository extends Repository<ImageSectionEntity> {
  constructor(private readonly dataSource: DataSource) {
    super(ImageSectionEntity, dataSource.createEntityManager());
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

  async upsertSection(sectionData: Partial<ImageSectionEntity>): Promise<ImageSectionEntity> {
    if (sectionData.id) {
      const existing = await this.findOne({ where: { id: sectionData.id } });

      if (!existing) {
        throw new NotFoundException(`Seção com ID=${sectionData.id} não encontrada.`);
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
