import { Injectable } from '@nestjs/common';
import {
  AppConflictException,
  AppNotFoundException,
  ErrorCode,
} from 'src/shared/exceptions';
import { PlayCategoryRepository } from '../repositories/play-category.repository';
import { PlayVideoEntryRepository } from '../repositories/play-video-entry.repository';
import { PlayCategoryResponseDto } from '../dto/play-video-response.dto';
import { SavePlayCategoryDto } from '../dto/play-engagement.dto';
import { toCategoryResponse } from '../mappers';
import { slugify } from '../utils';

/** Criação, edição e remoção de categorias (admin). */
@Injectable()
export class PlayCategoriesService {
  constructor(
    private readonly repo: PlayCategoryRepository,
    private readonly entries: PlayVideoEntryRepository,
  ) {}

  private async refreshed(id: string): Promise<PlayCategoryResponseDto> {
    const rows = await this.entries.findCategoriesWithCount();
    const row = rows.find((item) => item.id === id);
    if (!row) throw this.notFound();
    return toCategoryResponse(row);
  }

  private notFound(): AppNotFoundException {
    return new AppNotFoundException(
      ErrorCode.INVALID_INPUT,
      'Categoria não encontrada.',
    );
  }

  private async assertFreeSlug(slug: string, ignoreId?: string): Promise<void> {
    const found = await this.repo.findBySlug(slug);
    if (found && found.id !== ignoreId) {
      throw new AppConflictException(
        ErrorCode.INVALID_INPUT,
        'Já existe uma categoria com esse nome.',
      );
    }
  }

  async create(dto: SavePlayCategoryDto): Promise<PlayCategoryResponseDto> {
    const name = dto.name.trim();
    const slug = slugify(name);
    await this.assertFreeSlug(slug);
    const saved = await this.repo.save({
      name,
      slug,
      position: await this.repo.nextPosition(),
    });
    return this.refreshed(saved.id);
  }

  async update(
    id: string,
    dto: SavePlayCategoryDto,
  ): Promise<PlayCategoryResponseDto> {
    const category = await this.repo.findById(id);
    if (!category) throw this.notFound();
    const name = dto.name.trim();
    const slug = slugify(name);
    await this.assertFreeSlug(slug, id);
    await this.repo.save({ ...category, name, slug });
    return this.refreshed(id);
  }

  /** As galerias que usavam a categoria ficam sem categoria (FK `SET NULL`). */
  async remove(id: string): Promise<void> {
    const category = await this.repo.findById(id);
    if (!category) throw this.notFound();
    await this.repo.remove(category);
  }
}
