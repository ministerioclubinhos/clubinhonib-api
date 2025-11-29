import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { PagelasRepository } from './pagelas.repository';
import { CreatePagelaDto } from './dto/create-pagela.dto';
import { UpdatePagelaDto } from './dto/update-pagela.dto';
import { PagelaResponseDto } from './dto/pagela-response.dto';
import { PagelaFiltersDto } from './dto/pagela-filters.dto';
import { PaginationQueryDto, PaginatedResponse } from './dto/paginated.dto';
import { getAcademicWeekYear } from './week.util';
import { ClubControlRepository } from '../club-control/repositories/club-control.repository';

@Injectable()
export class PagelasService {
  constructor(
    private readonly repo: PagelasRepository,
    private readonly clubControlRepository: ClubControlRepository,
  ) { }

  /**
   * Criar uma pagela
   * 
   * REGRA CRÍTICA: A semana e o ano são calculados automaticamente baseado no período letivo
   * - Se week/year não for informado, será calculado automaticamente
   * - A semana é do ANO LETIVO, não da semana ISO do ano calendário
   * - A primeira semana dentro do período letivo é a "semana 1" do ano letivo
   * 
   * @throws BadRequestException se a data estiver fora do período letivo
   * @throws NotFoundException se não houver período letivo cadastrado
   */
  async create(dto: CreatePagelaDto): Promise<PagelaResponseDto> {
    let year: number;
    let week: number;

    // Se week e year foram informados, usar diretamente (para compatibilidade)
    if (dto.week && dto.year) {
      year = dto.year;
      week = dto.week;
    } else {
      // Calcular automaticamente baseado no período letivo
      const referenceDate = new Date(dto.referenceDate + 'T00:00:00');
      const referenceYear = referenceDate.getFullYear();
      
      // Buscar período letivo do ano da data de referência
      let period = await this.clubControlRepository.findPeriodByYear(referenceYear);
      
      // Se não encontrou, tentar ano anterior ou próximo (período pode cruzar anos)
      if (!period) {
        period = await this.clubControlRepository.findPeriodByYear(referenceYear - 1);
      }
      if (!period) {
        period = await this.clubControlRepository.findPeriodByYear(referenceYear + 1);
      }
      
      if (!period) {
        throw new NotFoundException(
          `Não há período letivo cadastrado para a data ${dto.referenceDate}. ` +
          `Por favor, cadastre um período letivo antes de criar pagelas.`
        );
      }

      try {
        // Calcular semana do ano letivo
        const academicWeek = getAcademicWeekYear(
          dto.referenceDate,
          period.startDate,
          period.endDate,
          period.year
        );
        year = academicWeek.year;
        week = academicWeek.week;
      } catch (error: any) {
        throw new BadRequestException(
          error.message || `Data ${dto.referenceDate} está fora do período letivo cadastrado.`
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
      totalPages: Math.ceil(total / limit),
    };
  }

  async findOne(id: string): Promise<PagelaResponseDto> {
    const item = await this.repo.findOneOrFail(id);
    return PagelaResponseDto.fromEntity(item);
  }

  /**
   * Atualizar uma pagela
   * 
   * REGRA: Se referenceDate for alterada, week e year serão recalculados automaticamente
   * baseado no período letivo, a menos que sejam informados explicitamente.
   */
  async update(id: string, dto: UpdatePagelaDto): Promise<PagelaResponseDto> {
    // Se referenceDate foi alterada e week/year não foram informados, recalcular
    if (dto.referenceDate && (!dto.week || !dto.year)) {
      const referenceDate = new Date(dto.referenceDate + 'T00:00:00');
      const referenceYear = referenceDate.getFullYear();
      
      // Buscar período letivo
      let period = await this.clubControlRepository.findPeriodByYear(referenceYear);
      if (!period) {
        period = await this.clubControlRepository.findPeriodByYear(referenceYear - 1);
      }
      if (!period) {
        period = await this.clubControlRepository.findPeriodByYear(referenceYear + 1);
      }
      
      if (period) {
        try {
          const academicWeek = getAcademicWeekYear(
            dto.referenceDate,
            period.startDate,
            period.endDate,
            period.year
          );
          
          // Se week/year não foram informados, usar os calculados
          if (!dto.week) {
            dto.week = academicWeek.week;
          }
          if (!dto.year) {
            dto.year = academicWeek.year;
          }
        } catch (error) {
          // Se não conseguiu calcular, manter valores existentes ou os informados
        }
      }
    }

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
