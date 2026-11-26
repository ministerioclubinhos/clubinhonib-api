import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { UserEntity } from 'src/core/user/entities/user.entity';
import { ImageSectionEntity } from '../entity/Image-section.entity';
import { ImageSectionCelebrationEntity } from '../entity/Image-section-celebration.entity';
import { CelebrationRow } from '../types';

/** Persistência das celebrações ("amém") das publicações do feed. */
@Injectable()
export class ImageSectionCelebrationsRepository {
  constructor(
    private readonly dataSource: DataSource,
    @InjectRepository(ImageSectionCelebrationEntity)
    private readonly repo: Repository<ImageSectionCelebrationEntity>,
  ) {}

  /** Todas as celebrações das seções, em uma consulta, na ordem em que vieram. */
  async findBySections(sectionIds: string[]): Promise<CelebrationRow[]> {
    if (!sectionIds.length) return [];
    return this.repo
      .createQueryBuilder('c')
      .innerJoin('c.user', 'user')
      .select('c.sectionId', 'sectionId')
      .addSelect('c.userId', 'userId')
      .addSelect('user.name', 'userName')
      .where('c.sectionId IN (:...ids)', { ids: sectionIds })
      .orderBy('c.createdAt', 'ASC')
      .getRawMany<CelebrationRow>();
  }

  /** Autor da seção; `undefined` quando a seção não existe. */
  async findSectionAuthorId(
    sectionId: string,
  ): Promise<string | null | undefined> {
    const section = await this.dataSource
      .getRepository(ImageSectionEntity)
      .findOne({ where: { id: sectionId }, relations: { author: true } });
    return section ? (section.author?.id ?? null) : undefined;
  }

  /** Alterna a celebração do usuário; devolve se ficou celebrada. */
  async toggle(sectionId: string, userId: string): Promise<boolean> {
    return this.dataSource.transaction(async (manager) => {
      const repo = manager.getRepository(ImageSectionCelebrationEntity);
      const existing = await repo.findOne({
        where: { section: { id: sectionId }, user: { id: userId } },
      });
      if (existing) {
        await repo.remove(existing);
        return false;
      }
      await repo.save(
        repo.create({
          section: { id: sectionId } as ImageSectionEntity,
          user: { id: userId } as UserEntity,
        }),
      );
      return true;
    });
  }
}
