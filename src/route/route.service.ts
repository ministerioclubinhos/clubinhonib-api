import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { RouteRepository } from './route-page.repository';
import { RouteEntity, RouteType } from './route-page.entity';
import { EntityManager } from 'typeorm';
import { GetMeditationService } from 'src/meditation/services/get-meditation.service';

@Injectable()
export class RouteService {
  private readonly logger = new Logger(RouteService.name);

  constructor(
    private readonly routeRepo: RouteRepository,
    private readonly getMeditationService: GetMeditationService

  ) { }

  generateRoute(title: string, prefix: string): string {
    const route = (
      prefix +
      title
        .toLowerCase()
        .normalize('NFD')
        .replace(/[̀-ͯ]/g, '')
        .replace(/[^\w\s]/gi, '')
        .replace(/\s+/g, '_')
        .replace(/_+/g, '_')
        .trim()
    );
    this.logger.debug(`🔤 Rota gerada: ${route}`);
    return route;
  }

  async generateAvailablePath(baseName: string, prefix: string): Promise<string> {
    const basePath = this.generateRoute(baseName, prefix);
    let candidate = basePath;
    let count = 1;

    while (await this.routeRepo.findByPath(candidate)) {
      candidate = `${basePath}_${count++}`;
    }

    this.logger.debug(`🆗 Caminho disponível: ${candidate}`);
    return candidate;
  }

  async createRoute(data: {
    title: string;
    public?: boolean;
    subtitle: string;
    idToFetch: string;
    path?: string;
    entityType: string;
    description: string;
    entityId: string;
    type: RouteType;
    image?: string;
    prefix?: string;
  }): Promise<RouteEntity> {
    const path = data.path || (await this.generateAvailablePath(data.title, data.prefix ?? ''));
    this.logger.debug(`🚧 Criando rota com path: "${path}"`);

    const route = new RouteEntity();
    Object.assign(route, {
      title: data.title,
      public: data.public ?? true,
      subtitle: data.subtitle,
      idToFetch: data.idToFetch,
      path,
      entityType: data.entityType,
      description: data.description,
      entityId: data.entityId,
      type: data.type,
      image: data.image || '',
    });

    const saved = await this.routeRepo.save(route);
    this.logger.debug(`✅ Rota criada: ID=${saved.id}`);
    return saved;
  }

  async updateRoute(id: string, updateData: Partial<Pick<RouteEntity, 'title' | 'description' | 'path' | 'subtitle'>>): Promise<RouteEntity> {
    const route = await this.routeRepo.findOne({ where: { id } });
    if (!route) throw new NotFoundException('Rota não encontrada');

    if (updateData.path) {
      const existing = await this.routeRepo.findByPath(updateData.path);
      if (existing && existing.id !== id) {
        throw new BadRequestException(`A rota "${updateData.path}" já está em uso`);
      }
    }

    Object.assign(route, updateData);
    const updated = await this.routeRepo.save(route);

    this.logger.debug(`✏️ Rota atualizada: ID=${updated.id}`);
    return updated;
  }

  async findAllRoutes(): Promise<RouteEntity[]> {
    this.logger.debug(`📄 Buscando todas as rotas`);

    const meditation = await this.getMeditationService.getThisWeekMeditation();
    const routes = await this.routeRepo.find();

    const meditationData = meditation.meditation;
    if (!meditationData) return routes;

    const dayRoutes = meditationData.days.map((day) => ({
      id: day.id,
      title: day.topic,
      subtitle: day.verse,
      description: day.verse,
      path: day.day,
      public: false,
      current: false,
      image: meditationData.media?.url,
      idToFetch: meditationData.id,
      entityType: 'MeditationDay',
      entityId: meditationData.id,
      type: 'page',
      createdAt: new Date(),
      updatedAt: new Date(),
    } as RouteEntity));

    routes.push(...dayRoutes);
    return routes;
  }


  async findById(id: string): Promise<RouteEntity | null> {
    this.logger.debug(`🔍 Buscando rota ID=${id}`);
    return this.routeRepo.findOne({ where: { id } });
  }

  async findRouteByEntityId(entityId: string): Promise<RouteEntity | null> {
    const route = await this.routeRepo.findOne({ where: { entityId } });
    if (!route) {
      this.logger.warn(`⚠️ Nenhuma rota encontrada para entityId=${entityId}`);
    }
    return route;
  }

  async removeRoute(id: string): Promise<void> {
    const route = await this.routeRepo.findOne({ where: { id } });
    if (!route) {
      this.logger.warn(`⚠️ Tentativa de remover rota inexistente ID=${id}`);
      return;
    }

    await this.routeRepo.remove(route);
    this.logger.debug(`🗑️ Rota removida: ID=${id}`);
  }

  async removeRouteByEntity(entityType: string, entityId: string): Promise<void> {
    const route = await this.routeRepo.findOne({ where: { entityType, entityId } });
    if (!route) {
      this.logger.warn(`⚠️ Nenhuma rota encontrada para ${entityType} com ID=${entityId}`);
      return;
    }

    await this.routeRepo.remove(route);
    this.logger.log(`✅ Rota removida: ID=${route.id}`);
  }

  async createRouteWithManager(
    manager: EntityManager,
    data: {
      title: string;
      public?: boolean;
      subtitle: string;
      idToFetch: string;
      path: string;
      entityType: string;
      description: string;
      entityId: string;
      type: RouteType;
      image?: string;
      current?: boolean
    },
  ): Promise<RouteEntity> {
    const route = manager.create(RouteEntity, {
      ...data,
      public: data.public ?? true,
      image: data.image || '',
    });

    return await manager.save(route);
  }

  async upsertRoute(routeId: string, updateData: Partial<RouteEntity>): Promise<RouteEntity> {
    const path = this.generateRoute(updateData.title || '', updateData.path || '');
    updateData.path = path;

    this.logger.debug(`🛠️ Upsert da rota ID=${routeId}, path="${path}"`);
    return this.routeRepo.upsertRoute(routeId, updateData);
  }
}
