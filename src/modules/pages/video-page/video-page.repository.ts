import { Injectable } from '@nestjs/common';
import { DataSource, Repository } from 'typeorm';
import { VideosPage } from './entities/video-page.entity';

@Injectable()
export class VideosPageRepository extends Repository<VideosPage> {
  constructor(private readonly dataSource: DataSource) {
    super(VideosPage, dataSource.createEntityManager());
  }

  async findById(id: string): Promise<VideosPage | null> {
    return this.findOne({
      where: { id },
      relations: ['route'],
    });
  }

  async findAll(): Promise<VideosPage[]> {
    return this.find({
      relations: ['route'],
      order: { id: 'ASC' },
    });
  }

  async upsertPage(data: Partial<VideosPage>): Promise<VideosPage> {
    if (data.id) {
      const existing = await this.preload(data);
      if (!existing) {
        throw new Error(`Página de vídeos com id=${data.id} não encontrada para atualização`);
      }
      return this.save(existing);
    }

    const created = this.create(data);
    return this.save(created);
  }

  async removePage(page: VideosPage): Promise<VideosPage> {
    return this.remove(page);
  }
}