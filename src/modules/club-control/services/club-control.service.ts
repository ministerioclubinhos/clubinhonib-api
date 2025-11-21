import { ConflictException, Injectable } from '@nestjs/common';
import { ClubControlRepository } from '../repositories/club-control.repository';
import { CreateClubPeriodDto } from '../dto/create-club-period.dto';
import { CreateClubExceptionDto } from '../dto/create-club-exception.dto';

/**
 * Service para Controle Global dos Clubes
 * 
 * REGRAS GLOBAIS:
 * - Um único período letivo por ano
 * - Exceções valem para todos os clubes
 * - Primeira semana do período = semana 1 do ano letivo
 */
@Injectable()
export class ClubControlService {
  constructor(
    private readonly clubControlRepository: ClubControlRepository,
  ) {}

  // ============= PERÍODOS LETIVOS GLOBAIS =============

  /**
   * Criar período letivo GLOBAL
   * Um período por ano, válido para todos os clubes
   */
  async createPeriod(dto: CreateClubPeriodDto) {
    // Verificar se já existe período para o ano (ativo ou inativo)
    const existing = await this.clubControlRepository.findAnyPeriodByYear(dto.year);
    if (existing) {
      if (existing.isActive) {
        throw new ConflictException(`Academic period for year ${dto.year} already exists`);
      }
      // Reativar e atualizar o período existente
      existing.startDate = dto.startDate;
      existing.endDate = dto.endDate;
      existing.description = dto.description;
      existing.isActive = dto.isActive ?? true;
      return this.clubControlRepository.savePeriod(existing);
    }

    // Criar novo período
    return this.clubControlRepository.createPeriod({
      year: dto.year,
      startDate: dto.startDate,
      endDate: dto.endDate,
      description: dto.description,
      isActive: dto.isActive ?? true,
    });
  }

  /**
   * Buscar período letivo por ano
   */
  async getPeriodByYear(year: number) {
    return this.clubControlRepository.findPeriodByYear(year);
  }

  /**
   * Listar todos os períodos letivos
   */
  async getAllPeriods(page?: number, limit?: number) {
    return this.clubControlRepository.findAllPeriods(page, limit);
  }

  /**
   * Desativar (soft delete) período letivo por ID
   */
  async deletePeriod(id: string) {
    return this.clubControlRepository.deletePeriod(id);
  }

  // ============= EXCEÇÕES GLOBAIS =============

  /**
   * Criar exceção GLOBAL
   * Uma exceção por data, válida para todos os clubes
   */
  async createException(dto: CreateClubExceptionDto) {
    return this.clubControlRepository.createException({
      exceptionDate: dto.exceptionDate,
      reason: dto.reason,
      type: dto.type || 'other',
      notes: dto.notes,
      isActive: dto.isActive ?? true,
      isRecurrent: dto.isRecurrent ?? false,
    });
  }

  /**
   * Buscar exceção por data
   */
  async getExceptionByDate(date: string) {
    return this.clubControlRepository.findExceptionByDate(date);
  }

  /**
   * Listar exceções em um período
   */
  async getExceptionsByPeriod(startDate?: string, endDate?: string, page?: number, limit?: number) {
    return this.clubControlRepository.findExceptionsByPeriod(startDate, endDate, page, limit);
  }

  // ============= PAINEL DE CONTROLE =============

  /**
   * Verificar um clube específico em uma semana
   * Para uso no painel de controle
   */
  async checkClubWeek(clubId: string, year: number, week: number) {
    return this.clubControlRepository.checkClubWeek(clubId, year, week);
  }

  /**
   * Verificar todos os clubes em uma semana
   * Para dashboard geral do administrador
   * 
   * ⭐ NOVO: Se year e week não forem fornecidos, calcula automaticamente a semana atual
   * do ano letivo baseado no período letivo cadastrado.
   * 
   * ⭐ NOVO: Se page e limit não forem fornecidos, usa valores padrão (page=1, limit=50).
   * 
   * @param year - Ano do período letivo (OPCIONAL - se não fornecido, usa semana atual)
   * @param week - Semana do ano letivo (OPCIONAL - se não fornecido, usa semana atual)
   * @param page - Página para paginação (default: 1)
   * @param limit - Limite por página (default: 50)
   */
  async checkAllClubsWeek(year?: number, week?: number, page: number = 1, limit: number = 50) {
    // ⭐ NOVO: Se year e week não foram fornecidos, calcular automaticamente a semana atual
    let finalYear = year;
    let finalWeek = week;
    
    if (year === undefined || week === undefined) {
      // Calcular semana atual do ano letivo automaticamente
      const currentAcademicWeek = await this.getCurrentAcademicWeek();
      
      if (!currentAcademicWeek) {
        // Se não há período letivo cadastrado, retornar resposta vazia
        return {
          year: null,
          week: null,
          summary: {
            totalClubs: 0,
            clubsOk: 0,
            clubsPartial: 0,
            clubsMissing: 0,
            clubsException: 0,
            clubsInactive: 0,
            clubsOutOfPeriod: 0,
          },
          clubs: [],
          pagination: {
            page,
            limit,
            total: 0,
            totalPages: 0,
            hasNextPage: false,
            hasPreviousPage: false,
          },
          currentWeek: {
            academicYear: null,
            academicWeek: null,
            isWithinPeriod: false,
            periodStartDate: null,
            periodEndDate: null,
          },
          note: 'Período letivo não cadastrado - nenhum clube retornado',
        };
      }
      
      // Usar semana atual calculada
      finalYear = currentAcademicWeek.year;
      finalWeek = currentAcademicWeek.week;
      
      // Se não está dentro do período, retornar resposta vazia
      if (!currentAcademicWeek.isWithinPeriod) {
        return {
          year: finalYear,
          week: finalWeek,
          summary: {
            totalClubs: 0,
            clubsOk: 0,
            clubsPartial: 0,
            clubsMissing: 0,
            clubsException: 0,
            clubsInactive: 0,
            clubsOutOfPeriod: 0,
          },
          clubs: [],
          pagination: {
            page,
            limit,
            total: 0,
            totalPages: 0,
            hasNextPage: false,
            hasPreviousPage: false,
          },
          currentWeek: {
            academicYear: finalYear,
            academicWeek: finalWeek,
            isWithinPeriod: false,
            periodStartDate: currentAcademicWeek.periodStartDate,
            periodEndDate: currentAcademicWeek.periodEndDate,
          },
          note: 'Fora do período letivo - nenhum clube retornado',
        };
      }
    }
    
    // Chamar repository com year e week (agora garantidos)
    const result = await this.clubControlRepository.checkAllClubsWeek(finalYear!, finalWeek!, page, limit);
    
    // Garantir que sempre tenha informação da semana atual
    if (!result.currentWeek) {
      const currentAcademicWeek = await this.getCurrentAcademicWeek();
      if (currentAcademicWeek) {
        result.currentWeek = {
          academicYear: currentAcademicWeek.year,
          academicWeek: currentAcademicWeek.week,
          isWithinPeriod: currentAcademicWeek.isWithinPeriod,
          periodStartDate: currentAcademicWeek.periodStartDate,
          periodEndDate: currentAcademicWeek.periodEndDate,
        };
      }
    }
    
    return result;
  }

  /**
   * Dashboard da semana ATUAL
   * Não requer parâmetros, sempre mostra a semana atual
   */
  async getCurrentWeekDashboard() {
    const now = new Date();
    const year = now.getFullYear();
    const week = this.getISOWeek(now);

    const result = await this.checkAllClubsWeek(year, week);
    
    // Adicionar informação da semana atual do ano letivo
    const currentAcademicWeek = await this.getCurrentAcademicWeek();
    
    return {
      ...result,
      currentWeek: {
        academicYear: currentAcademicWeek?.year || null,
        academicWeek: currentAcademicWeek?.week || null,
        isWithinPeriod: currentAcademicWeek?.isWithinPeriod || false,
        periodStartDate: currentAcademicWeek?.periodStartDate || null,
        periodEndDate: currentAcademicWeek?.periodEndDate || null,
      },
    };
  }

  /**
   * Obter a semana atual do ano letivo
   * Retorna null se não houver período letivo cadastrado ou se estiver fora do período
   * 
   * REGRA: A primeira semana dentro do período é a "semana 1" do ano letivo
   */
  async getCurrentAcademicWeek(): Promise<{
    year: number;
    week: number;
    isWithinPeriod: boolean;
    periodStartDate: string;
    periodEndDate: string;
  } | null> {
    const now = new Date();
    const currentYear = now.getFullYear();
    
    // Buscar período letivo do ano atual
    const period = await this.clubControlRepository.findPeriodByYear(currentYear);
    
    if (!period) {
      return null;
    }

    const startDate = new Date(period.startDate + 'T00:00:00');
    const endDate = new Date(period.endDate + 'T23:59:59');
    const nowDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    
    // Verificar se a data atual está dentro do período letivo
    if (nowDate < startDate || nowDate > endDate) {
      return {
        year: period.year,
        week: 0,
        isWithinPeriod: false,
        periodStartDate: period.startDate,
        periodEndDate: period.endDate,
      };
    }

    // Calcular a semana do ano letivo
    // A primeira semana que contém o startDate é a semana 1
    // Calcular quantas semanas completas se passaram desde o início do período
    const startWeekStart = this.getWeekStartDate(startDate);
    const currentWeekStart = this.getWeekStartDate(nowDate);
    
    // Diferença em dias
    const daysDiff = Math.floor((currentWeekStart.getTime() - startWeekStart.getTime()) / (1000 * 60 * 60 * 24));
    // Quantidade de semanas completas + 1 (primeira semana é semana 1)
    const week = Math.floor(daysDiff / 7) + 1;

    return {
      year: period.year,
      week: Math.max(1, week),
      isWithinPeriod: true,
      periodStartDate: period.startDate,
      periodEndDate: period.endDate,
    };
  }

  /**
   * Obter a data de início da semana (segunda-feira) para uma data
   */
  private getWeekStartDate(date: Date): Date {
    const d = new Date(date);
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1); // Ajustar para segunda-feira
    return new Date(d.setDate(diff));
  }

  /**
   * Análise detalhada dos indicadores de uma semana
   * Retorna informações completas sobre todos os indicadores, problemas e recomendações
   * 
   * Filtros disponíveis:
   * - status: Filtrar por status (ok, partial, missing, exception, inactive, out_of_period)
   * - severity: Filtrar por severidade (critical, warning, info, success)
   * - weekday: Filtrar por dia da semana
   * - indicatorType: Filtrar por tipo de indicador
   * - hasProblems: Apenas clubes com problemas (true/false)
   * - page: Página (opcional)
   * - limit: Limite por página (opcional)
   */
  async getDetailedIndicators(
    year: number, 
    week: number,
    filters?: {
      status?: string;
      severity?: string;
      weekday?: string;
      indicatorType?: string;
      hasProblems?: boolean;
      page?: number;
      limit?: number;
    }
  ) {
    return this.clubControlRepository.getDetailedIndicators(year, week, filters);
  }

  // ============= HELPERS =============

  private getISOWeek(date: Date): number {
    const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
    d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    return Math.ceil((((+d - +yearStart) / 86400000) + 1) / 7);
  }
}

