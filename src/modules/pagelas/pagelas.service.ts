import { Injectable } from '@nestjs/common';
import {
  AppNotFoundException,
  AppBusinessException,
  ErrorCode,
} from 'src/shared/exceptions';
import { PagelasRepository } from './pagelas.repository';
import { CreatePagelaDto } from './dto/create-pagela.dto';
import { UpdatePagelaDto } from './dto/update-pagela.dto';
import { PagelaResponseDto } from './dto/pagela-response.dto';
import { PagelaFiltersDto } from './dto/pagela-filters.dto';
import { PaginatedResponse } from './dto/paginated.dto';
import { getAcademicWeekYear } from './week.util';
import { ClubControlRepository } from '../club-control/repositories/club-control.repository';
import { PagelaEntity } from './entities/pagela.entity';
import { TeacherProfileEntity } from '../teacher-profiles/entities/teacher-profile.entity/teacher-profile.entity';

@Injectable()
export class PagelasService {
  constructor(
    private readonly repo: PagelasRepository,
    private readonly clubControlRepository: ClubControlRepository,
  ) {}

  async create(dto: CreatePagelaDto): Promise<PagelaResponseDto> {
    let year: number;
    let week: number;

    if (dto.week && dto.year) {
      year = dto.year;
      week = dto.week;
    } else {
      const referenceDate = new Date(dto.referenceDate + 'T00:00:00');
      const referenceYear = referenceDate.getFullYear();

      let period =
        await this.clubControlRepository.findPeriodByYear(referenceYear);

      if (!period) {
        period = await this.clubControlRepository.findPeriodByYear(
          referenceYear - 1,
        );
      }
      if (!period) {
        period = await this.clubControlRepository.findPeriodByYear(
          referenceYear + 1,
        );
      }

      if (!period) {
        throw new AppNotFoundException(
          ErrorCode.RESOURCE_NOT_FOUND,
          `Não há período letivo cadastrado para a data ${dto.referenceDate}. ` +
            `Por favor, cadastre um período letivo antes de criar pagelas.`,
        );
      }

      try {
        const academicWeek = getAcademicWeekYear(
          dto.referenceDate,
          period.startDate,
          period.endDate,
          period.year,
        );
        year = academicWeek.year;
        week = academicWeek.week;
      } catch (error: unknown) {
        const errMessage = error instanceof Error ? error.message : undefined;
        throw new AppBusinessException(
          ErrorCode.INVALID_DATE_RANGE,
          errMessage ||
            `Data ${dto.referenceDate} está fora do período letivo cadastrado.`,
        );
      }
    }

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

  async findAllSimple(
    filters?: PagelaFiltersDto,
  ): Promise<PagelaResponseDto[]> {
    const items = await this.repo.findAllSimple(filters);
    return items.map((item) => PagelaResponseDto.fromEntity(item));
  }

  async findAllPaginated(
    filters: PagelaFiltersDto | undefined,
    page: number,
    limit: number,
  ): Promise<PaginatedResponse<PagelaResponseDto>> {
    const { items, total } = await this.repo.findAllPaginated(
      filters,
      page,
      limit,
    );
    return {
      items: items.map((item) => PagelaResponseDto.fromEntity(item)),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async findOne(id: string): Promise<PagelaResponseDto> {
    const item = await this.repo.findOneOrFail(id);
    return PagelaResponseDto.fromEntity(item);
  }

  async update(id: string, dto: UpdatePagelaDto): Promise<PagelaResponseDto> {
    if (dto.referenceDate && (!dto.week || !dto.year)) {
      const referenceDate = new Date(dto.referenceDate + 'T00:00:00');
      const referenceYear = referenceDate.getFullYear();

      let period =
        await this.clubControlRepository.findPeriodByYear(referenceYear);
      if (!period) {
        period = await this.clubControlRepository.findPeriodByYear(
          referenceYear - 1,
        );
      }
      if (!period) {
        period = await this.clubControlRepository.findPeriodByYear(
          referenceYear + 1,
        );
      }

      if (period) {
        try {
          const academicWeek = getAcademicWeekYear(
            dto.referenceDate,
            period.startDate,
            period.endDate,
            period.year,
          );

          if (!dto.week) {
            dto.week = academicWeek.week;
          }
          if (!dto.year) {
            dto.year = academicWeek.year;
          }
        } catch {
          // Ignore errors - week/year will use existing values or be undefined
        }
      }
    }

    const updateData: Partial<PagelaEntity> = {
      referenceDate: dto.referenceDate ?? undefined,
      year: dto.year ?? undefined,
      week: dto.week ?? undefined,
      present: dto.present ?? undefined,
      didMeditation: dto.didMeditation ?? undefined,
      recitedVerse: dto.recitedVerse ?? undefined,
      notes: dto.notes ?? undefined,
    };

    if (dto.teacherProfileId !== undefined) {
      updateData.teacher = dto.teacherProfileId
        ? ({ id: dto.teacherProfileId } as TeacherProfileEntity)
        : null;
    }

    const updated = await this.repo.updateOne(id, updateData);

    return PagelaResponseDto.fromEntity(updated);
  }

  async remove(id: string): Promise<void> {
    await this.repo.remove(id);
  }
}
