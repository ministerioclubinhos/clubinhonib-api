import { Injectable } from '@nestjs/common';
import { DataSource, EntityManager, Repository } from 'typeorm';
import { RouteEntity } from './route-page.entity';
import { toRoutePath } from './utils';

@Injectable()
export class RouteRepository extends Repository<RouteEntity> {
  constructor(private readonly dataSource: DataSource) {
    super(RouteEntity, dataSource.createEntityManager());
  }

  async findAllRoutes(): Promise<RouteEntity[]> {
    return this.find({
      order: { createdAt: 'ASC' },
    });
  }

  async findById(id: string): Promise<RouteEntity | null> {
    return this.findOne({ where: { id } });
  }

  async removeById(id: string): Promise<void> {
    const route = await this.findOne({ where: { id } });
    if (route) {
      await this.remove(route);
    }
  }

  async findByPath(path: string): Promise<RouteEntity | null> {
    return this.findOne({ where: { path } });
  }

  /** A rota de uma entidade, sem filtrar pelo tipo. */
  async findByEntityId(entityId: string): Promise<RouteEntity | null> {
    return this.findOne({ where: { entityId } });
  }

  /** Grava a rota como está. */
  async saveRoute(route: RouteEntity): Promise<RouteEntity> {
    return this.save(route);
  }

  /** Remove a rota informada. */
  async removeRoute(route: RouteEntity): Promise<void> {
    await this.remove(route);
  }

  /**
   * Um `path` livre para o título informado.
   *
   * `path` é único no banco, então gerar a partir do título sem conferir
   * disponibilidade quebra assim que duas páginas ganham o mesmo nome. O laço
   * mora aqui porque cada volta é uma consulta.
   *
   * `excludeRouteId` deixa a própria rota manter o path na edição, em vez de
   * colidir consigo mesma e ganhar um sufixo desnecessário.
   */
  async findAvailablePath(
    baseName: string,
    prefix: string,
    excludeRouteId?: string,
  ): Promise<string> {
    const base = toRoutePath(baseName, prefix);
    let candidato = base;
    let contador = 1;

    for (;;) {
      const existente = await this.findByPath(candidato);
      if (!existente || existente.id === excludeRouteId) break;
      candidato = `${base}_${contador++}`;
    }

    return candidato;
  }

  /** Cria a rota dentro da transação em curso. */
  async createInTransaction(
    manager: EntityManager,
    data: Partial<RouteEntity>,
  ): Promise<RouteEntity> {
    return manager.save(manager.create(RouteEntity, data));
  }

  async findByEntity(
    entityType: string,
    entityId: string,
  ): Promise<RouteEntity | null> {
    return this.findOne({ where: { entityType, entityId } });
  }

  async upsertRoute(
    routeId: string,
    updateData: Partial<RouteEntity>,
    manager?: EntityManager,
  ): Promise<RouteEntity> {
    const repository = manager
      ? manager.getRepository(RouteEntity)
      : (this as Repository<RouteEntity>);

    return repository.save({
      ...updateData,
      id: routeId,
    });
  }
}
