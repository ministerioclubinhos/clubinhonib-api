// src/modules/pagelas/pagelas.service.ts
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
  constructor(private readonly repo: PagelasRepository) {}

  // CREATE
  async create(dto: CreatePagelaDto): Promise<PagelaResponseDto> {
    // week vem do front (obrigatório)
    const week = dto.week;

    // year é opcional: se não vier, calculo pelo referenceDate (mas NÃO valido consistência)
    const year = dto.year ?? getISOWeekYear(dto.referenceDate).year;

    const created = await this.repo.createOne({
      childId: dto.childId,
      teacherProfileId: dto.teacherProfileId ?? null,
      referenceDate: dto.referenceDate, // data do registro
      year,                             // semana alvo (ano)
      week,                             // semana alvo (semana)
      present: dto.present,
      didMeditation: dto.didMeditation,
      recitedVerse: dto.recitedVerse,
      notes: dto.notes ?? null,
    });

    return PagelaResponseDto.fromEntity(created);
  }

  // LIST (simple)
  async findAllSimple(filters?: PagelaFiltersDto): Promise<PagelaResponseDto[]> {
    const items = await this.repo.findAllSimple(filters);
    return items.map(PagelaResponseDto.fromEntity);
  }

  // LIST (paginated)
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

  // GET by id
  async findOne(id: string): Promise<PagelaResponseDto> {
    const item = await this.repo.findOneOrFail(id);
    return PagelaResponseDto.fromEntity(item);
  }

  // UPDATE
  async update(id: string, dto: UpdatePagelaDto): Promise<PagelaResponseDto> {
    // Aqui NÃO fazemos validação cruzada nem recalculamos automaticamente.
    // Atualizamos apenas o que veio.
    const updated = await this.repo.updateOne(id, {
      teacher: dto.teacherProfileId === undefined
        ? undefined
        : (dto.teacherProfileId ? ({ id: dto.teacherProfileId } as any) : null),

      referenceDate: dto.referenceDate ?? undefined, // pode ser diferente da week/year
      year: dto.year ?? undefined,                   // opcional
      week: dto.week ?? undefined,                   // opcional
      present: dto.present ?? undefined,
      didMeditation: dto.didMeditation ?? undefined,
      recitedVerse: dto.recitedVerse ?? undefined,
      notes: dto.notes ?? undefined,
    } as any);

    return PagelaResponseDto.fromEntity(updated);
  }

  // DELETE
  async remove(id: string): Promise<void> {
    await this.repo.remove(id);
  }
}
