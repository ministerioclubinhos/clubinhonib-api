import { Injectable } from '@nestjs/common';
import { PagelasRepository } from './pagelas.repository';
import { CreatePagelaDto } from './dto/create-pagela.dto';
import { UpdatePagelaDto } from './dto/update-pagela.dto';
import { PagelaResponseDto } from './dto/pagela-response.dto';
import { PagelaFiltersDto } from './dto/pagela-filters.dto';
import { PaginationQueryDto, PaginatedResponse } from './dto/paginated.dto';
import { getISOWeekYear } from './week.util';

@Injectable()
export class PagelasService {
  constructor(private readonly repo: PagelasRepository) { }

  async create(dto: CreatePagelaDto): Promise<PagelaResponseDto> {
    const week = dto.week;
    const year = dto.year ?? getISOWeekYear(dto.referenceDate).year;

    const created = await this.repo.createOne({
      childId: dto.childId,
      teacherProfileId: dto.teacherProfileId ?? null,
      referenceDate: dto.referenceDate,
      year,
      week,
      present: dto.present,
      didMeditation: dto.didMeditation,
      recitedVerse: dto.recitedVerse,
      notes: dto.notes ?? null,
    });

    return PagelaResponseDto.fromEntity(created);
  }

  async findAllSimple(filters?: PagelaFiltersDto): Promise<PagelaResponseDto[]> {
    const items = await this.repo.findAllSimple(filters);
    return items.map(PagelaResponseDto.fromEntity);
  }

  async findAllPaginated(
    filters: PagelaFiltersDto | undefined,
    page: number,
    limit: number,
  ): Promise<PaginatedResponse<PagelaResponseDto>> {
    const { items, total } = await this.repo.findAllPaginated(filters, page, limit);
    return {
      items: items.map(PagelaResponseDto.fromEntity),
      total,
      page,
      limit,
    };
  }

  async findOne(id: string): Promise<PagelaResponseDto> {
    const item = await this.repo.findOneOrFail(id);
    return PagelaResponseDto.fromEntity(item);
  }

  async update(id: string, dto: UpdatePagelaDto): Promise<PagelaResponseDto> {

    const updated = await this.repo.updateOne(id, {
      teacher: dto.teacherProfileId === undefined
        ? undefined
        : (dto.teacherProfileId ? ({ id: dto.teacherProfileId } as any) : null),

      referenceDate: dto.referenceDate ?? undefined,
      year: dto.year ?? undefined,
      week: dto.week ?? undefined,
      present: dto.present ?? undefined,
      didMeditation: dto.didMeditation ?? undefined,
      recitedVerse: dto.recitedVerse ?? undefined,
      notes: dto.notes ?? undefined,
    } as any);

    return PagelaResponseDto.fromEntity(updated);
  }

  async remove(id: string): Promise<void> {
    await this.repo.remove(id);
  }
}
