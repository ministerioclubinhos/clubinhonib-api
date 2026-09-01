import { Injectable } from '@nestjs/common';
import { DataSource, EntityManager, Repository } from 'typeorm';
import { RouteEntity, RouteType } from './route-page.entity';

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

  async findByEntity(
    entityType: string,
    entityId: string,
  ): Promise<RouteEntity | null> {
    return this.findOne({ where: { entityType, entityId } });
  }

  async createRoute(
    path: string,
    entityType: string,
    entityId: string,
    description: string,
    type: RouteType,
  ): Promise<RouteEntity> {
    const route = this.create({
      path,
      entityType,
      entityId,
      description,
      type,
    });
    return this.save(route);
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
