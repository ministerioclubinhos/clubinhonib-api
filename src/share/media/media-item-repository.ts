import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { MediaItemEntity } from './media-item/media-item.entity';

@Injectable()
export class MediaItemRepository {
  private readonly logger = new Logger(MediaItemRepository.name);

  constructor(
    @InjectRepository(MediaItemEntity)
    private readonly mediaRepo: Repository<MediaItemEntity>,
  ) {}

  async findByTarget(targetId: string, targetType: string): Promise<MediaItemEntity[]> {
    this.logger.debug(`🔍 Buscando mídias por targetId=${targetId}, targetType=${targetType}`);
    return this.mediaRepo.find({ where: { targetId, targetType } });
  }

  async findManyByTargets(targetIds: string[], targetType: string): Promise<MediaItemEntity[]> {
    this.logger.debug(`🔍 Buscando mídias para múltiplos targets do tipo ${targetType}`);
    return this.mediaRepo.find({
      where: {
        targetType,
        targetId: In(targetIds),
      },
    });
  }

  async save(media: MediaItemEntity): Promise<MediaItemEntity> {
    const saved = await this.mediaRepo.save(media);
    this.logger.debug(`💾 Mídia salva: ID=${saved.id}, título=${saved.title}`);
    return saved;
  }

  async saveById(id: string, data: Partial<MediaItemEntity>): Promise<MediaItemEntity> {
    await this.mediaRepo.upsert(
      { ...data, id },
      ['id'], // unique constraint
    );
    const updated = await this.mediaRepo.findOneBy({ id });
    this.logger.debug(`🔁 Mídia upserted (saveById): ID=${id}, título=${updated?.title}`);
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
