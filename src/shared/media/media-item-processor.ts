import { Injectable, Logger } from '@nestjs/common';
import { MediaItemEntity, UploadType } from './media-item/media-item.entity';
import { MediaItemRepository } from './media-item-repository';

@Injectable()
export class MediaItemProcessor {
  private readonly logger = new Logger(MediaItemProcessor.name);

  constructor(private readonly mediaRepo: MediaItemRepository) { }

  async findMediaItemsByTarget(targetId: string, targetType: string): Promise<MediaItemEntity[]> {
    return this.mediaRepo.findByTarget(targetId, targetType);
  }

  async findMediaItemByTarget(targetId: string, targetType: string): Promise<MediaItemEntity | null> {
    const items = await this.findMediaItemsByTarget(targetId, targetType);
    return items.length > 0 ? items[0] : null;
  }

  async findManyMediaItemsByTargets(targetIds: string[], targetType: string): Promise<MediaItemEntity[]> {
    return this.mediaRepo.findManyByTargets(targetIds, targetType);
  }

  buildBaseMediaItem(item: any, targetId: string, targetType: string): MediaItemEntity {
    const media = new MediaItemEntity();
    media.title = item.title;
    media.description = item.description;
    media.mediaType = item.mediaType;
    media.uploadType = item.uploadType;
    media.platformType = item.platformType;
    media.url = item.url;
    media.originalName = item.originalName;
    media.size = item.size;
    media.isLocalFile = item.isLocalFile;
    media.targetId = targetId;
    media.targetType = targetType;
    return media;
  }

  async saveMediaItem(media: MediaItemEntity): Promise<MediaItemEntity> {
    return this.mediaRepo.save(media);
  }

  async upsertMediaItem(id: string | undefined, media: MediaItemEntity): Promise<MediaItemEntity> {
    if (id) {
      await this.mediaRepo.saveById(id, media);
      this.logger.debug(`✏️ Mídia atualizada: ID=${id}, título="${media.title}"`);
      media.id = id;
      return media;
    } else {
      const created = await this.saveMediaItem(media);
      this.logger.debug(`🆕 Mídia criada: ID=${created.id}, título="${created.title}"`);
      return created;
    }
  }

  async deleteMediaItems(items: MediaItemEntity[], deleteFn: (url: string) => Promise<void>): Promise<void> {
    for (const item of items) {
      if (item.isLocalFile) {
        this.logger.debug(`🗑️ Deletando do S3: ${item.url}`);
        await deleteFn(item.url);
      }
    }
    await this.mediaRepo.removeMany(items);
  }

  async removeMediaItem(item: MediaItemEntity, deleteFn?: (url: string) => Promise<void>): Promise<void> {
    if (item.isLocalFile && deleteFn) {
      this.logger.debug(`🧹 Limpando do S3: ${item.url}`);
      await deleteFn(item.url);
    }
    await this.mediaRepo.removeOne(item);
  }

  async processMediaItemsPolymorphic(
    items: any[],
    targetId: string,
    targetType: string,
    filesDict: Record<string, Express.Multer.File>,
    uploadFn: (file: Express.Multer.File) => Promise<string>,
  ): Promise<MediaItemEntity[]> {
    const results: MediaItemEntity[] = [];

    for (const item of items) {
      const media = this.buildBaseMediaItem(item, targetId, targetType);

      if (item.uploadType === UploadType.UPLOAD) {
        const file = filesDict[item.fileField];
        if (!file) throw new Error(`Arquivo ausente para "${item.title}"`);

        this.logger.debug(`⬆️ Upload: ${file.originalname}`);
        media.url = await uploadFn(file);
        media.isLocalFile = true;
        media.originalName = file.originalname;
        media.size = file.size;
      } else {
        media.url = item.url?.trim() || '';
        media.isLocalFile = false;
      }

      const saved = await this.saveMediaItem(media);
      results.push(saved);
    }

    return results;
  }

  async cleanAndReplaceMediaItems(
    items: any[],
    targetId: string,
    targetType: string,
    filesDict: Record<string, Express.Multer.File>,
    oldItems: MediaItemEntity[],
    deleteFn: (url: string) => Promise<void>,
    uploadFn: (file: Express.Multer.File) => Promise<string>,
  ): Promise<MediaItemEntity[]> {
    const logger = new Logger('MediaItemCleaner');
    logger.debug(`📦 Substituindo mídias para targetId=${targetId}`);

    const validIncoming = items.filter((item) => {
      if (item.uploadType !== UploadType.UPLOAD) return true;

      const fileRef = item.url || item.fileField;
      const exists = oldItems.some((old) => old.url === fileRef);
      const hasFile = !!filesDict[item.fileField];

      if (!exists && !hasFile) {
        logger.warn(`⚠️ Upload ignorado: campo ausente para "${item.title}"`);
      }

      return exists || hasFile;
    });

    const validUploadUrls = new Set(
      validIncoming
        .filter((item) => item.uploadType === UploadType.UPLOAD)
        .map((item) => {
          const fileRef = item.url || item.fileField;
          return oldItems.find((old) => old.url === fileRef)?.url;
        })
        .filter(Boolean),
    );

    const toRemove = oldItems.filter((item) => item.isLocalFile && !validUploadUrls.has(item.url));
    if (toRemove.length) {
      logger.debug(`🗑️ Removendo ${toRemove.length} mídia(s) antiga(s) do S3`);
      await this.deleteMediaItems(toRemove, deleteFn);
    }

    const results: MediaItemEntity[] = [];

    for (const item of validIncoming) {
      const media = this.buildBaseMediaItem(item, targetId, targetType);

      if (item.uploadType === UploadType.UPLOAD) {
        const previous = oldItems.find((old) => old.url === (item.url || item.fileField));

        if (previous) {
          media.url = previous.url;
          media.isLocalFile = previous.isLocalFile;
          media.originalName = previous.originalName;
          media.size = previous.size;
          logger.debug(`🔁 Reutilizando mídia existente: ${previous.originalName}`);
        } else {
          const file = filesDict[item.fileField];
          if (!file) throw new Error(`Arquivo ausente para "${item.title}"`);

          logger.debug(`⬆️ Upload novo: ${file.originalname}`);
          media.url = await uploadFn(file);
          media.isLocalFile = true;
          media.originalName = file.originalname;
          media.size = file.size;
        }
      } else {
        media.url = item.url?.trim() || '';
        media.isLocalFile = false;
      }

      const saved = await this.upsertMediaItem(item.id, media);
      results.push(saved);
    }

    return results;
  }
}
