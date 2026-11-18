import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, In, Repository } from 'typeorm';
import { MediaItemEntity } from './media-item/media-item.entity';

@Injectable()
export class MediaItemRepository {
  private readonly logger = new Logger(MediaItemRepository.name);

  constructor(
    @InjectRepository(MediaItemEntity)
    private readonly mediaRepo: Repository<MediaItemEntity>,
  ) {}

  async findByTarget(
    targetId: string,
    targetType: string,
  ): Promise<MediaItemEntity[]> {
    this.logger.debug(
      `🔍 Buscando mídias por targetId=${targetId}, targetType=${targetType}`,
    );
    return this.mediaRepo.find({ where: { targetId, targetType } });
  }

  /** Mídias de um alvo em qualquer um dos tipos informados. */
  async findByTargetAnyType(
    targetId: string,
    targetTypes: string[],
  ): Promise<MediaItemEntity[]> {
    if (targetTypes.length === 0) return [];
    return this.mediaRepo.find({
      where: { targetId, targetType: In(targetTypes) },
    });
  }

  /** Mídias de vários alvos em qualquer um dos tipos informados. */
  async findManyByTargetsAnyType(
    targetIds: string[],
    targetTypes: string[],
  ): Promise<MediaItemEntity[]> {
    if (targetIds.length === 0 || targetTypes.length === 0) return [];
    return this.mediaRepo.find({
      where: { targetId: In(targetIds), targetType: In(targetTypes) },
    });
  }

  async findManyByTargets(
    targetIds: string[],
    targetType: string,
  ): Promise<MediaItemEntity[]> {
    this.logger.debug(
      `🔍 Buscando mídias para múltiplos targets do tipo ${targetType}`,
    );
    return this.mediaRepo.find({
      where: {
        targetType,
        targetId: In(targetIds),
      },
    });
  }

  /** Mídias que apontam para alguma das URLs informadas. */
  /** Uma mídia pelo id, ou `null` quando não existe. */
  async findById(id: string): Promise<MediaItemEntity | null> {
    return this.mediaRepo.findOneBy({ id });
  }

  /** Mídias de um alvo, lidas dentro da transação em curso. */
  async findByTargetInTransaction(
    manager: EntityManager,
    targetId: string,
    targetType: string,
  ): Promise<MediaItemEntity[]> {
    return manager.find(MediaItemEntity, { where: { targetId, targetType } });
  }

  /** Grava a mídia dentro da transação em curso. */
  async saveInTransaction(
    manager: EntityManager,
    media: Partial<MediaItemEntity>,
  ): Promise<MediaItemEntity> {
    return manager.save(MediaItemEntity, media as MediaItemEntity);
  }

  /** Apaga uma mídia pelo id, dentro da transação em curso. */
  async deleteByIdInTransaction(
    manager: EntityManager,
    id: string,
  ): Promise<void> {
    await manager.delete(MediaItemEntity, { id });
  }

  /** Apaga todas as mídias de um alvo, dentro da transação em curso. */
  async deleteByTargetInTransaction(
    manager: EntityManager,
    targetId: string,
    targetType: string,
  ): Promise<void> {
    await manager.delete(MediaItemEntity, { targetId, targetType });
  }

  async findByUrls(urls: string[]): Promise<MediaItemEntity[]> {
    if (urls.length === 0) return [];
    return this.mediaRepo.find({ where: { url: In(urls) } });
  }

  async save(media: MediaItemEntity): Promise<MediaItemEntity> {
    const saved = await this.mediaRepo.save(media);
    this.logger.debug(`💾 Mídia salva: ID=${saved.id}, título=${saved.title}`);
    return saved;
  }

  async saveById(
    id: string,
    data: Partial<MediaItemEntity>,
  ): Promise<MediaItemEntity> {
    await this.mediaRepo.upsert({ ...data, id }, ['id']);
    const updated = await this.mediaRepo.findOneBy({ id });
    this.logger.debug(
      `🔁 Mídia upserted (saveById): ID=${id}, título=${updated?.title}`,
    );
    return updated!;
  }

  async update(id: string, partial: Partial<MediaItemEntity>): Promise<void> {
    await this.mediaRepo.update(id, partial);
    this.logger.debug(`✏️ Mídia atualizada: ID=${id}`);
  }

  async removeMany(items: MediaItemEntity[]): Promise<void> {
    await this.mediaRepo.remove(items);
    this.logger.debug(`🧹 ${items.length} mídias removidas do banco de dados.`);
  }

  async removeOne(item: MediaItemEntity): Promise<void> {
    await this.mediaRepo.remove(item);
    this.logger.debug(`🧽 Mídia removida: ID=${item.id}, título=${item.title}`);
  }
}
