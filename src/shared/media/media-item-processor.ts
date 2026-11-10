import { Injectable, Logger } from '@nestjs/common';
import { EntityManager } from 'typeorm';
import { AppValidationException, ErrorCode } from 'src/shared/exceptions';
import { MediaItemEntity, UploadType } from './media-item/media-item.entity';
import { MediaItemRepository } from './media-item-repository';
import { MediaType, PlatformType } from './media-item/media-item.entity';

export interface MediaItemInput {
  title?: string;
  description?: string;
  mediaType?: MediaType | string;
  uploadType?: UploadType;
  platformType?: PlatformType | null;
  url?: string;
  originalName?: string;
  size?: number | string;
  isLocalFile?: boolean;
  fileField?: string;
  id?: string;
  /**
   * O nome do campo do multipart, como o formulário o envia.
   *
   * Este módulo lê `fileField`; `fieldKey` chega junto porque é o nome que os
   * DTOs de página usam, e cada caso de uso copia um no outro. Ambos são
   * declarados porque a alternativa era um `[key: string]: any`, que tornava
   * qualquer objeto aceitável aqui.
   */
  fieldKey?: string;
  /** Alguns formulários mandam o tipo de upload também com este nome. */
  type?: UploadType;
}

@Injectable()
export class MediaItemProcessor {
  private readonly logger = new Logger(MediaItemProcessor.name);

  constructor(private readonly mediaRepo: MediaItemRepository) {}

  /**
   * Uma mídia pelo id.
   *
   * Existe para os casos de uso não alcançarem a tabela de mídia por conta
   * própria: quem conhece a persistência da mídia é este módulo.
   */
  async findMediaItemById(id: string): Promise<MediaItemEntity | null> {
    return this.mediaRepo.findById(id);
  }

  async findMediaItemsByTarget(
    targetId: string,
    targetType: string,
  ): Promise<MediaItemEntity[]> {
    return this.mediaRepo.findByTarget(targetId, targetType);
  }

  async findMediaItemByTarget(
    targetId: string,
    targetType: string,
  ): Promise<MediaItemEntity | null> {
    const items = await this.findMediaItemsByTarget(targetId, targetType);
    return items.length > 0 ? items[0] : null;
  }

  /**
   * Mídias de um alvo aceitando mais de um `targetType`. Existe para módulos
   * cujo histórico gravou o tipo com grafias diferentes: procurar só pela
   * grafia atual deixaria a mídia antiga invisível — e o arquivo dela órfão no
   * S3 quando o alvo fosse removido.
   */
  async findMediaItemsByTargetAnyType(
    targetId: string,
    targetTypes: string[],
  ): Promise<MediaItemEntity[]> {
    return this.mediaRepo.findByTargetAnyType(targetId, targetTypes);
  }

  /** Igual à anterior, para vários alvos de uma vez. */
  async findManyMediaItemsByTargetsAnyType(
    targetIds: string[],
    targetTypes: string[],
  ): Promise<MediaItemEntity[]> {
    return this.mediaRepo.findManyByTargetsAnyType(targetIds, targetTypes);
  }

  async findManyMediaItemsByTargets(
    targetIds: string[],
    targetType: string,
  ): Promise<MediaItemEntity[]> {
    return this.mediaRepo.findManyByTargets(targetIds, targetType);
  }

  buildBaseMediaItem(
    item: MediaItemInput,
    targetId: string,
    targetType: string,
  ): MediaItemEntity {
    const media = new MediaItemEntity();
    media.title = item.title || '';
    media.description = item.description || '';
    media.mediaType = (item.mediaType as MediaType) || ('image' as MediaType);
    media.uploadType = item.uploadType || UploadType.LINK;
    media.platformType = item.platformType || undefined;
    media.url = item.url || '';
    media.originalName = item.originalName || '';
    media.size = item.size ? Number(item.size) : 0;
    media.isLocalFile = item.isLocalFile || false;
    media.targetId = targetId;
    media.targetType = targetType;
    return media;
  }

  /**
   * Mídias de um alvo, lidas dentro da transação em curso.
   *
   * Existe para os casos de uso participarem de uma transação sem alcançar a
   * tabela de mídia por conta própria.
   */
  async findMediaItemsByTargetInTransaction(
    manager: EntityManager,
    targetId: string,
    targetType: string,
  ): Promise<MediaItemEntity[]> {
    return this.mediaRepo.findByTargetInTransaction(
      manager,
      targetId,
      targetType,
    );
  }

  /** Grava a mídia dentro da transação em curso. */
  async saveMediaItemInTransaction(
    manager: EntityManager,
    media: Partial<MediaItemEntity>,
  ): Promise<MediaItemEntity> {
    return this.mediaRepo.saveInTransaction(manager, media);
  }

  /** Apaga uma mídia pelo id, dentro da transação em curso. */
  async deleteMediaItemByIdInTransaction(
    manager: EntityManager,
    id: string,
  ): Promise<void> {
    await this.mediaRepo.deleteByIdInTransaction(manager, id);
  }

  /** Apaga todas as mídias de um alvo, dentro da transação em curso. */
  async deleteMediaItemsByTargetInTransaction(
    manager: EntityManager,
    targetId: string,
    targetType: string,
  ): Promise<void> {
    await this.mediaRepo.deleteByTargetInTransaction(
      manager,
      targetId,
      targetType,
    );
  }

  async saveMediaItem(media: MediaItemEntity): Promise<MediaItemEntity> {
    return this.mediaRepo.save(media);
  }

  async upsertMediaItem(
    id: string | undefined,
    media: MediaItemEntity,
  ): Promise<MediaItemEntity> {
    if (id) {
      await this.mediaRepo.saveById(id, media);
      this.logger.debug(`Mídia atualizada: ID=${id}`);
      media.id = id;
      return media;
    } else {
      const created = await this.saveMediaItem(media);
      this.logger.debug(`Mídia criada: ID=${created.id}`);
      return created;
    }
  }

  async deleteMediaItems(
    items: MediaItemEntity[],
    deleteFn: (url: string) => Promise<void>,
  ): Promise<void> {
    await this.mediaRepo.removeMany(items);
    await this.discardUnreferencedUploads(
      items.filter((item) => item.isLocalFile).map((item) => item.url),
      deleteFn,
    );
  }

  async removeMediaItem(
    item: MediaItemEntity,
    deleteFn?: (url: string) => Promise<void>,
  ): Promise<void> {
    await this.mediaRepo.removeOne(item);
    if (item.isLocalFile && deleteFn)
      await this.discardUnreferencedUploads([item.url], deleteFn);
  }

  async processMediaItemsPolymorphic(
    items: MediaItemInput[],
    targetId: string,
    targetType: string,
    filesDict: Record<string, Express.Multer.File>,
    uploadFn: (file: Express.Multer.File) => Promise<string>,
    manager?: EntityManager,
  ): Promise<MediaItemEntity[]> {
    const results: MediaItemEntity[] = [];

    for (const item of items) {
      const media = this.buildBaseMediaItem(item, targetId, targetType);

      if (item.uploadType === UploadType.UPLOAD) {
        if (!item.fileField)
          throw new Error(
            `Campo de arquivo não especificado para "${item.title}"`,
          );
        const file = filesDict[item.fileField];
        if (!file) throw new Error(`Arquivo ausente para "${item.title}"`);

        this.logger.debug(`Upload de mídia: targetId=${targetId}`);
        media.url = await uploadFn(file);
        media.isLocalFile = true;
        media.originalName = file.originalname;
        media.size = file.size;
      } else {
        media.url = item.url?.trim() || '';
        media.isLocalFile = false;
      }

      const saved = manager
        ? await this.saveMediaItemInTransaction(manager, media)
        : await this.saveMediaItem(media);
      results.push(saved);
    }

    return results;
  }

  /**
   * Apaga do S3 os arquivos enviados durante uma operação que falhou e que não
   * ficaram referenciados por nenhuma mídia. O que sobrou referenciado é
   * preservado: apagar o objeto de um registro já gravado deixaria a mídia
   * apontando para um arquivo inexistente, que é pior do que um órfão.
   *
   * Devolve quantos arquivos foram descartados.
   */
  async discardUnreferencedUploads(
    urls: string[],
    deleteFn: (url: string) => Promise<void>,
  ): Promise<number> {
    if (urls.length === 0) return 0;

    const referenced = new Set(
      (await this.mediaRepo.findByUrls(urls)).map((item) => item.url),
    );
    const orphans = [...new Set(urls)].filter((url) => !referenced.has(url));

    for (const url of orphans) {
      try {
        await deleteFn(url);
      } catch (error: unknown) {
        this.logger.error(
          `ÓRFÃO NO S3: falha ao descartar o upload ${url}`,
          error instanceof Error ? error.stack : undefined,
        );
      }
    }

    if (orphans.length > 0) {
      this.logger.warn(
        `${orphans.length} upload(s) sem referência descartado(s) do S3.`,
      );
    }

    return orphans.length;
  }

  /**
   * Substitui as mídias de um alvo por um conjunto novo.
   *
   * Nada é apagado antes de gravar: primeiro os arquivos novos sobem e as
   * mídias são gravadas; só então saem as linhas que não sobreviveram e os
   * arquivos que ninguém mais referencia. A ordem inversa deixava o alvo sem
   * arquivo nenhum quando o upload do substituto falhava.
   */
  async cleanAndReplaceMediaItems(
    items: MediaItemInput[],
    targetId: string,
    targetType: string,
    filesDict: Record<string, Express.Multer.File>,
    oldItems: MediaItemEntity[],
    deleteFn: (url: string) => Promise<void>,
    uploadFn: (file: Express.Multer.File) => Promise<string>,
  ): Promise<MediaItemEntity[]> {
    const logger = new Logger('MediaItemCleaner');
    logger.debug(`📦 Substituindo mídias para targetId=${targetId}`);

    /**
     * A mídia atual correspondente ao item recebido. O id vem primeiro: um
     * upload reenviado sem arquivo novo costuma trazer só o id, e procurar
     * apenas pela url faria o item parecer desconhecido — e a mídia atual
     * seria apagada.
     */
    const resolvePrevious = (
      item: MediaItemInput,
    ): MediaItemEntity | undefined => {
      const byId = item.id
        ? oldItems.find((old) => old.id === item.id)
        : undefined;
      if (byId) return byId;

      const fileRef = item.url || item.fileField;
      return fileRef ? oldItems.find((old) => old.url === fileRef) : undefined;
    };

    const results: MediaItemEntity[] = [];

    for (const item of items) {
      const media = this.buildBaseMediaItem(item, targetId, targetType);
      const previous = resolvePrevious(item);

      if (item.uploadType === UploadType.UPLOAD) {
        const file = item.fileField ? filesDict[item.fileField] : undefined;

        if (file) {
          logger.debug(`Novo upload de mídia: targetId=${targetId}`);
          media.url = await uploadFn(file);
          media.isLocalFile = true;
          media.originalName = file.originalname;
          media.size = file.size;
        } else if (previous?.isLocalFile && previous.url) {
          // Sem arquivo novo, o objeto que já está no S3 é preservado.
          media.url = previous.url;
          media.isLocalFile = previous.isLocalFile;
          media.originalName = previous.originalName;
          media.size = previous.size;
          logger.debug(
            `🔁 Reutilizando mídia existente: ${previous.originalName}`,
          );
        } else {
          // Recusar é obrigatório: seguir em frente descartaria o item e, com
          // ele, a mídia atual do alvo.
          throw new AppValidationException(
            ErrorCode.MEDIA_FILE_NOT_FOUND,
            `Arquivo ausente para a mídia "${item.title ?? ''}".`,
          );
        }
      } else {
        media.url = item.url?.trim() || '';
        media.isLocalFile = false;
      }

      const saved = await this.upsertMediaItem(item.id ?? previous?.id, media);
      results.push(saved);
    }

    // Só saem as linhas que a substituição não reaproveitou. Uma linha
    // atualizada sobrevive: removê-la aqui apagaria o registro que acabou de
    // receber o arquivo novo.
    const savedIds = new Set(results.map((item) => item.id));
    const staleRows = oldItems.filter((old) => !savedIds.has(old.id));
    if (staleRows.length > 0) {
      await this.mediaRepo.removeMany(staleRows);
      logger.debug(`🧹 ${staleRows.length} mídia(s) antiga(s) removida(s)`);
    }

    // E do S3 sai apenas o arquivo que nenhuma mídia gravada referencia mais.
    const keptUrls = new Set(results.map((item) => item.url));
    const staleFiles = oldItems.filter(
      (old) => old.isLocalFile && old.url && !keptUrls.has(old.url),
    );

    await this.discardUnreferencedUploads(
      staleFiles.map((item) => item.url),
      deleteFn,
    );

    return results;
  }
}
