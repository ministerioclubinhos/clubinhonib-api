import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import {
  DataSource,
  EntityManager,
  Repository,
  SelectQueryBuilder,
} from 'typeorm';

import { MediaItemEntity } from 'src/shared/media/media-item/media-item.entity';

import { DocumentEntity } from '../entities/document.entity';
import { QueryDocumentsDto } from '../dto/query-documents.dto';
import {
  DOCUMENTS_DEFAULT_LIMIT,
  DOCUMENTS_DEFAULT_PAGE,
  DOCUMENT_DEFAULT_ORDER,
  DOCUMENT_DEFAULT_SORT,
  DOCUMENT_MEDIA_TARGET_TYPES,
  DOCUMENT_SORT_COLUMNS,
} from '../constants';

@Injectable()
export class DocumentsRepository {
  constructor(
    private readonly dataSource: DataSource,
    @InjectRepository(DocumentEntity)
    private readonly repo: Repository<DocumentEntity>,
  ) {}

  /**
   * Roda um conjunto de escritas numa transação só.
   *
   * Abrir e fechar transação é acesso ao banco, e mora aqui. O caso de uso
   * continua decidindo o que é atômico — recebe o `EntityManager` e o repassa
   * a este repositório e aos serviços de outros módulos que participam da mesma
   * transação —, mas não conhece `QueryRunner`, commit nem rollback.
   */
  async runInTransaction<T>(
    work: (manager: EntityManager) => Promise<T>,
  ): Promise<T> {
    return this.dataSource.transaction(work);
  }

  /** Cria o documento dentro da transação em curso. */
  async createInTransaction(
    manager: EntityManager,
    data: { name: string; description?: string },
  ): Promise<DocumentEntity> {
    const repo = manager.getRepository(DocumentEntity);
    const document = repo.create({
      name: data.name,
      description: data.description,
    });

    return repo.save(document);
  }

  /** Grava o documento como está — por exemplo, depois de vincular a rota. */
  async saveInTransaction(
    manager: EntityManager,
    document: DocumentEntity,
  ): Promise<DocumentEntity> {
    return manager.save(DocumentEntity, document);
  }

  /** Aplica os campos recebidos sobre o documento e grava. */
  async updateInTransaction(
    manager: EntityManager,
    document: DocumentEntity,
    changes: { name?: string; description?: string },
  ): Promise<DocumentEntity> {
    const merged = manager.merge(DocumentEntity, document, changes);

    return manager.save(DocumentEntity, merged);
  }

  private baseQB(): SelectQueryBuilder<DocumentEntity> {
    return this.repo
      .createQueryBuilder('document')
      .leftJoinAndSelect('document.route', 'route');
  }

  /**
   * Aplica busca e presença de arquivo.
   *
   * Tudo é filtrado no banco: a listagem inteira chegava ao navegador só para
   * ser peneirada lá.
   */
  private applyFilters(
    qb: SelectQueryBuilder<DocumentEntity>,
    query: QueryDocumentsDto,
  ): void {
    const search = query.searchString?.trim();

    if (search) {
      qb.andWhere(
        `(
          LOWER(document.name) LIKE LOWER(:search) OR
          LOWER(document.description) LIKE LOWER(:search)
        )`,
        { search: `%${search}%` },
      );
    }

    if (query.hasMedia !== undefined) {
      // As duas grafias de `targetType` entram na conta: linhas antigas foram
      // gravadas em minúsculas.
      const existeMidia = qb
        .subQuery()
        .select('1')
        .from(MediaItemEntity, 'media')
        .where('media.targetId = document.id')
        .andWhere('media.targetType IN (:...targetTypes)')
        .getQuery();

      qb.andWhere(
        query.hasMedia ? `EXISTS ${existeMidia}` : `NOT EXISTS ${existeMidia}`,
        { targetTypes: DOCUMENT_MEDIA_TARGET_TYPES },
      );
    }
  }

  async findAllPaginated(
    query: QueryDocumentsDto,
  ): Promise<{ items: DocumentEntity[]; total: number }> {
    const {
      page = DOCUMENTS_DEFAULT_PAGE,
      limit = DOCUMENTS_DEFAULT_LIMIT,
      sort = DOCUMENT_DEFAULT_SORT,
      order = DOCUMENT_DEFAULT_ORDER,
    } = query;

    const qb = this.baseQB();
    this.applyFilters(qb, query);

    qb.orderBy(DOCUMENT_SORT_COLUMNS[sort], order)
      .skip((page - 1) * limit)
      .take(limit);

    const [items, total] = await qb.getManyAndCount();

    return { items, total };
  }

  /** Documento com a rota carregada, para as operações de escrita. */
  async findByIdWithRoute(id: string): Promise<DocumentEntity | null> {
    return this.repo.findOne({ where: { id }, relations: { route: true } });
  }

  async remove(document: DocumentEntity): Promise<void> {
    await this.repo.remove(document);
  }

  async findById(id: string): Promise<DocumentEntity | null> {
    return this.repo.findOne({ where: { id }, relations: { route: true } });
  }
}
