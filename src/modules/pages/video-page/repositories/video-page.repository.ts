import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, Repository } from 'typeorm';
import { VideosPage } from '../entities/video-page.entity';
import { VIDEO_PAGE_RELATIONS } from '../constants';
import { VideoPageContent } from '../types';

@Injectable()
export class VideosPageRepository {
  constructor(
    @InjectRepository(VideosPage)
    private readonly pageRepo: Repository<VideosPage>,
  ) {}

  private scoped(manager?: EntityManager): Repository<VideosPage> {
    return manager ? manager.getRepository(VideosPage) : this.pageRepo;
  }

  async findAll(): Promise<VideosPage[]> {
    return this.pageRepo.find({
      relations: [...VIDEO_PAGE_RELATIONS],
      order: { createdAt: 'DESC' },
    });
  }

  async findById(
    id: string,
    manager?: EntityManager,
  ): Promise<VideosPage | null> {
    return this.scoped(manager).findOne({
      where: { id },
      relations: [...VIDEO_PAGE_RELATIONS],
    });
  }

  async createPage(
    content: VideoPageContent,
    manager?: EntityManager,
  ): Promise<VideosPage> {
    const repository = this.scoped(manager);
    return repository.save(repository.create(content));
  }

  async savePage(
    page: VideosPage,
    manager?: EntityManager,
  ): Promise<VideosPage> {
    return this.scoped(manager).save(page);
  }

  async removePage(page: VideosPage, manager?: EntityManager): Promise<void> {
    await this.scoped(manager).remove(page);
  }
}
