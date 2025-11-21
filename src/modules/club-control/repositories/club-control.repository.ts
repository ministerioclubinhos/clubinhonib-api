import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ClubPeriodEntity } from '../entities/club-period.entity';
import { ClubExceptionEntity } from '../entities/club-exception.entity';
import { ClubControlLogEntity } from '../entities/club-control-log.entity';
import { ClubEntity } from 'src/modules/clubs/entities/club.entity/club.entity';
import { ChildEntity } from 'src/modules/children/entities/child.entity';
import { PagelaEntity } from 'src/modules/pagelas/entities/pagela.entity';
import { getAcademicWeekYear } from 'src/modules/pagelas/week.util';

@Injectable()
export class ClubControlRepository {
  constructor(
    @InjectRepository(ClubPeriodEntity)
    private readonly periodsRepository: Repository<ClubPeriodEntity>,
    @InjectRepository(ClubExceptionEntity)
    private readonly exceptionsRepository: Repository<ClubExceptionEntity>,
    @InjectRepository(ClubControlLogEntity)
    private readonly logsRepository: Repository<ClubControlLogEntity>,
    @InjectRepository(ClubEntity)
    private readonly clubsRepository: Repository<ClubEntity>,
    @InjectRepository(ChildEntity)
    private readonly childrenRepository: Repository<ChildEntity>,
    @InjectRepository(PagelaEntity)
    private readonly pagelasRepository: Repository<PagelaEntity>,
  ) {}

  // ============= PERÍODOS LETIVOS GLOBAIS =============

  /**
   * Criar período letivo GLOBAL (um por ano)
   */
  async createPeriod(data: any): Promise<ClubPeriodEntity> {
    const period = this.periodsRepository.create(data);
    return await this.periodsRepository.save(period) as unknown as ClubPeriodEntity;
  }

  /**
   * Buscar período letivo por ano
   */
  async findPeriodByYear(year: number): Promise<ClubPeriodEntity | null> {
    return this.periodsRepository.findOne({
      where: { year, isActive: true },
    });
  }

  /**
   * Buscar período (ativo ou inativo) por ano
   */
  async findAnyPeriodByYear(year: number): Promise<ClubPeriodEntity | null> {
    return this.periodsRepository.findOne({
      where: { year },
      withDeleted: false,
    });
  }

  /**
   * Listar todos os períodos letivos
   */
  async findAllPeriods(page?: number, limit?: number): Promise<{ items: ClubPeriodEntity[]; total: number }> {
    const where = { isActive: true } as any;
    const total = await this.periodsRepository.count({ where });
    let items: ClubPeriodEntity[];
    if (page && limit) {
      const skip = (page - 1) * limit;
      items = await this.periodsRepository.find({
        where,
        order: { year: 'DESC' },
        skip,
        take: limit,
      });
    } else {
      items = await this.periodsRepository.find({
        where,
        order: { year: 'DESC' },
      });
    }
    return { items, total };
  }

  /**
   * Salvar/atualizar período
   */
  async savePeriod(entity: ClubPeriodEntity): Promise<ClubPeriodEntity> {
    return this.periodsRepository.save(entity);
  }

  /**
   * Desativar (soft delete) período letivo por ID
   */
  async deletePeriod(id: string): Promise<{ success: boolean }> {
    const existing = await this.periodsRepository.findOne({ where: { id } });
    if (!existing) {
      return { success: false };
    }
    if (existing.isActive === false) {
      return { success: true };
    }
    existing.isActive = false;
    await this.periodsRepository.save(existing);
    return { success: true };
  }

  // ============= EXCEÇÕES GLOBAIS =============

  /**
   * Criar exceção GLOBAL (uma por data)
   */
  async createException(data: any): Promise<ClubExceptionEntity> {
    const exception = this.exceptionsRepository.create(data);
    return await this.exceptionsRepository.save(exception) as unknown as ClubExceptionEntity;
  }

  /**
   * Buscar exceção por data específica
   */
  async findExceptionByDate(date: string): Promise<ClubExceptionEntity | null> {
    return this.exceptionsRepository.findOne({
      where: { exceptionDate: date, isActive: true },
    });
  }

  /**
   * Listar exceções em um período
   */
  async findExceptionsByPeriod(startDate?: string, endDate?: string, page?: number, limit?: number): Promise<{ items: ClubExceptionEntity[]; total: number }> {
    const query = this.exceptionsRepository
      .createQueryBuilder('exception')
      .where('exception.isActive = :isActive', { isActive: true });

    if (startDate) {
      query.andWhere('exception.exceptionDate >= :startDate', { startDate });
    }

    if (endDate) {
      query.andWhere('exception.exceptionDate <= :endDate', { endDate });
    }

    // Count total before pagination
    const total = await query.getCount();

    if (page && limit) {
      const skip = (page - 1) * limit;
      query.skip(skip).take(limit);
    }

    const items = await query.orderBy('exception.exceptionDate', 'ASC').getMany();
    return { items, total };
  }

  // ============= VERIFICAÇÕES DE CONTROLE =============

  /**
   * Verificar um clube específico em uma semana
   * 
   * ⚠️ IMPORTANTE: year e week são do ANO LETIVO, não semana ISO!
   * - year: Ano do período letivo (ex: 2024)
   * - week: Semana do ano letivo (semana 1 = primeira semana dentro do período letivo)
   * 
   * As pagelas são armazenadas com semana do ano letivo, então esses parâmetros
   * devem corresponder à semana do ano letivo, não à semana ISO do ano calendário.
   */
  async checkClubWeek(clubId: string, year: number, week: number, includeCurrentWeek?: boolean): Promise<any> {
    const club = await this.clubsRepository.findOne({
      where: { id: clubId },
    });

    if (!club) {
      throw new Error('Club not found');
    }

    // ✅ VERIFICAR PERÍODO LETIVO PRIMEIRO (antes de buscar pagelas)
    // Isso garante que apenas semanas dentro do período sejam processadas
    const period = await this.findPeriodByYear(year);
    
    // ⚠️ CRÍTICO: Calcular total de semanas do período letivo
    // Se o período tem 30 semanas, semana 31+ NÃO deve ser processada
    let maxAcademicWeek = 0;
    if (period) {
      const start = new Date(period.startDate);
      const end = new Date(period.endDate);
      
      const getWeekStartDate = (date: Date): Date => {
        const d = new Date(date);
        const day = d.getDay();
        const diff = d.getDate() - day + (day === 0 ? -6 : 1);
        return new Date(d.setDate(diff));
      };
      
      const startWeekStart = getWeekStartDate(start);
      const endWeekStart = getWeekStartDate(end);
      
      const daysDiff = Math.floor((endWeekStart.getTime() - startWeekStart.getTime()) / (1000 * 60 * 60 * 24));
      maxAcademicWeek = Math.floor(daysDiff / 7) + 1; // Última semana do período letivo
    }
    
    // ⚠️ CRÍTICO: Validar se a semana passada está dentro do período letivo
    // Se período tem 30 semanas, semana > 30 não deve ser processada
    if (period && maxAcademicWeek > 0 && week > maxAcademicWeek) {
      return {
        clubId: club.id,
        clubNumber: club.number,
        weekday: club.weekday,
        week: {
          year,
          week,
          expectedDate: null,
        },
        children: {
          total: 0,
          activeCount: 0,
          inactiveCount: 0,
          withPagela: 0,
          missing: 0,
          missingList: [],
          note: "Apenas crianças ATIVAS e que já tinham entrado são consideradas",
        },
        status: 'out_of_period',
        indicators: [], // SEM indicadores quando está fora do período
        exception: null,
        period: {
          year: period.year,
          startDate: period.startDate,
          endDate: period.endDate,
        },
        note: `Semana ${week} está fora do período letivo (período tem ${maxAcademicWeek} semanas) - indicadores não são gerados`,
      };
    }

    // Calcular data esperada primeiro para verificar data de entrada
    // ⚠️ CRÍTICO: Usar semana ACADÊMICA, não ISO
    const expectedDate = club.weekday && period ? this.getExpectedDateForAcademicWeek(year, week, club.weekday, period) : null;

    // Buscar todas as crianças do clube que estão ATIVAS
    const allChildren = await this.childrenRepository.find({
      where: { club: { id: clubId } },
    });

    // ✅ FILTRAR: Apenas crianças ATIVAS e que já tinham entrado antes/durante a semana
    const expectedDateObj = expectedDate ? new Date(expectedDate) : null;
    const activeChildren = allChildren.filter((child) => {
      // 1. Deve estar ativa
      if (child.isActive === false) {
        return false;
      }

      // 2. Se tem joinedAt, verificar se já tinha entrado antes/durante a semana
      if (child.joinedAt && expectedDateObj) {
        const joinedDate = new Date(child.joinedAt);
        // Considerar que a criança só precisa de pagela se já tinha entrado antes/durante a semana
        return joinedDate <= expectedDateObj;
      }

      // Se não tem joinedAt, considerar como se sempre estivesse no clube
      return true;
    });

    const totalChildren = activeChildren.length;
    const inactiveCount = allChildren.length - totalChildren;

    // ⚠️ IMPORTANTE: Buscar pagelas pela semana do ANO LETIVO
    // year e week são do período letivo, não semana ISO
    // As pagelas são armazenadas com semana do ano letivo
    // 
    // ⚠️ CRÍTICO: A busca já filtra por year e week específicos
    // Se período tem 30 semanas e buscamos semana 31, não encontrará nenhuma pagela (correto)
    // Se período tem 30 semanas e buscamos semana 30, encontrará apenas pagelas da semana 30
    // Se não há pagela da semana 1 até 30, childrenWithPagela será 0 e entrará como "falta"
    const childIds = activeChildren.map(c => c.id);
    const pagelas = childIds.length > 0 ? await this.pagelasRepository
      .createQueryBuilder('pagela')
      .leftJoin('pagela.child', 'child')
      .leftJoin('child.club', 'club')
      .where('club.id = :clubId', { clubId })
      .andWhere('pagela.year = :year', { year }) // Ano do período letivo
      .andWhere('pagela.week = :week', { week }) // Semana do ano letivo (1-N, onde N = total de semanas do período)
      .andWhere('child.id IN (:...childIds)', { childIds })
      .select('DISTINCT child.id', 'childId')
      .getRawMany() : [];
    
    // ⚠️ CRÍTICO: Se a semana passada está fora do período letivo (semana > maxAcademicWeek),
    // não encontrará nenhuma pagela, o que é correto. A validação já foi feita acima.
    // Se não há pagela da semana 1 até 30 (dentro do período), childrenWithPagela será 0
    // e childrenMissing será igual a totalChildren, gerando indicador negativo (correto!)

    const childrenWithPagela = pagelas.length;
    const childrenMissing = totalChildren - childrenWithPagela;

    // Listar crianças sem pagela (apenas as ativas e que já tinham entrado)
    const childIdsWithPagela = pagelas.map((p) => p.childId);
    const childrenMissingList = activeChildren
      .filter((c) => !childIdsWithPagela.includes(c.id))
      .map((c) => ({
        childId: c.id,
        childName: c.name,
      }));

    // Validar weekday - se não tiver, retornar status especial
    if (!club.weekday) {
      return {
        clubId: club.id,
        clubNumber: club.number,
        weekday: null,
        week: {
          year,
          week,
          expectedDate: null,
        },
        children: {
          total: totalChildren,
          withPagela: childrenWithPagela,
          missing: childrenMissing,
          missingList: childrenMissingList,
        },
        status: 'inactive',
        indicators: [{
          type: 'no_weekday',
          severity: 'info',
          message: `ℹ️ Clube sem dia da semana definido (provavelmente inativo)`,
        }],
        exception: null,
      };
    }

    // ✅ Verificar se está dentro do período letivo (precisa de expectedDate)
    // O período já foi buscado acima e maxAcademicWeek já foi calculado
    let isWithinPeriod = false;
    
    // Se não há período letivo cadastrado, retorna SEM indicadores
    if (!period) {
      return {
        clubId: club.id,
        clubNumber: club.number,
        weekday: club.weekday,
        week: {
          year,
          week,
          expectedDate,
        },
        children: {
          total: totalChildren,
          activeCount: totalChildren,
          inactiveCount: inactiveCount,
          withPagela: childrenWithPagela,
          missing: childrenMissing,
          missingList: childrenMissingList,
          note: "Apenas crianças ATIVAS e que já tinham entrado são consideradas",
        },
        status: 'ok', // Status neutro quando não há período letivo
        indicators: [], // SEM indicadores quando não há período letivo
        exception: null,
        note: 'Período letivo não cadastrado - indicadores não são gerados',
      };
    }
    
    // Verificar se está dentro do período letivo (precisa de expectedDate)
    if (period && expectedDate) {
      const expectedDateObj = new Date(expectedDate);
      const startDateObj = new Date(period.startDate);
      const endDateObj = new Date(period.endDate);

      isWithinPeriod = expectedDateObj >= startDateObj && expectedDateObj <= endDateObj;
      
      // Se a data está FORA do período letivo, retorna SEM indicadores
      if (!isWithinPeriod) {
        return {
          clubId: club.id,
          clubNumber: club.number,
          weekday: club.weekday,
          week: {
            year,
            week,
            expectedDate,
          },
          children: {
            total: totalChildren,
            activeCount: totalChildren,
            inactiveCount: inactiveCount,
            withPagela: childrenWithPagela,
            missing: childrenMissing,
            missingList: childrenMissingList,
            note: "Apenas crianças ATIVAS e que já tinham entrado são consideradas",
          },
          status: 'out_of_period',
          indicators: [], // SEM indicadores quando está fora do período
          exception: null,
          period: {
            year: period.year,
            startDate: period.startDate,
            endDate: period.endDate,
          },
          note: 'Fora do período letivo - indicadores não são gerados',
        };
      }
    } else if (period && !expectedDate) {
      // Se há período mas não há expectedDate (sem weekday), retorna SEM indicadores
      return {
        clubId: club.id,
        clubNumber: club.number,
        weekday: club.weekday,
        week: {
          year,
          week,
          expectedDate,
        },
        children: {
          total: totalChildren,
          activeCount: totalChildren,
          inactiveCount: inactiveCount,
          withPagela: childrenWithPagela,
          missing: childrenMissing,
          missingList: childrenMissingList,
          note: "Apenas crianças ATIVAS e que já tinham entrado são consideradas",
        },
        status: 'ok',
        indicators: [], // SEM indicadores quando não há expectedDate
        exception: null,
        note: 'Sem data esperada - indicadores não são gerados',
      };
    }

    // ⚠️ Se chegou aqui, está DENTRO do período letivo e tem expectedDate
    // Agora sim pode gerar indicadores (positivos e negativos)

    // Verificar se é exceção GLOBAL (apenas se expectedDate não for null)
    const exception = expectedDate ? await this.findExceptionByDate(expectedDate) : null;

    // ⚠️ CRÍTICO: Verificar se já passou o dia do clubinho DA SEMANA ATUAL
    // Indicadores negativos só são retornados se:
    // 1. A semana consultada é a SEMANA ATUAL do ano letivo
    // 2. E o dia do clubinho da semana atual já passou
    // Exemplo: Se clubinho é no sábado e hoje é sexta → não mostra indicadores negativos
    // Exemplo: Se clubinho é no sábado e hoje é domingo → mostra indicadores negativos
    let hasPassedClubDay = false;
    let isCurrentWeek = false; // Variável para usar na determinação de status
    if (expectedDate) {
      // 1. Primeiro verificar se a semana consultada é a semana ATUAL
      // Cachear o cálculo da semana atual para evitar múltiplas chamadas
      // (será calculado uma vez no início de checkAllClubsWeek)
      const currentAcademicWeek = await this.calculateCurrentAcademicWeek();
      
      isCurrentWeek = !!(currentAcademicWeek && 
                         currentAcademicWeek.academicYear === year && 
                         currentAcademicWeek.academicWeek === week &&
                         currentAcademicWeek.isWithinPeriod);
      
      if (!isCurrentWeek) {
        // Não é a semana atual → para semanas passadas, sempre considerar que já passou o dia
        // (para calcular status corretamente: ok, partial, missing)
        hasPassedClubDay = true; // Semanas passadas: sempre considerar que já passou (para calcular status correto)
      } else {
        // É a semana atual → verificar se o dia já passou
        const today = new Date();
        const todayStr = today.toISOString().split('T')[0]; // Formato: YYYY-MM-DD
        
        // Comparar strings de data diretamente (YYYY-MM-DD)
        // Se hoje é maior que o dia esperado, já passou o dia do clubinho (mostrar indicadores negativos)
        // Exemplo: Se clube é no sábado (2025-11-22) e hoje é sexta (2025-11-21) → não passou (false, não mostra indicador)
        // Exemplo: Se clube é no sábado (2025-11-22) e hoje é domingo (2025-11-23) → passou (true, mostra indicador)
        hasPassedClubDay = todayStr > expectedDate;
      }
    }

    // ⚠️ CRÍTICO: Determinar status
    // Status 'pending' APENAS para semana ATUAL quando ainda não passou o dia
    // Para semanas passadas, sempre calcular status baseado em pagelas (ok, partial, missing)
    let status: string;
    if (exception) {
      status = 'exception';
    } else if (!hasPassedClubDay && isCurrentWeek) {
      // ⚠️ APENAS para semana ATUAL quando ainda não passou o dia
      // Se ainda não passou o dia do clubinho na semana atual
      if (childrenWithPagela === totalChildren && totalChildren > 0) {
        // Todas as crianças já têm pagela (lançaram antecipadamente)
        status = 'ok';
      } else {
        // Ainda não passou o dia, mas não tem pagelas (ou parcial)
        // Status 'pending' = pendente, mas ainda dentro do prazo (não está atrasado)
        status = 'pending';
      }
    } else if (childrenWithPagela === totalChildren) {
      // Já passou o dia (ou semana passada) e todas as crianças têm pagela
      status = 'ok';
    } else if (childrenWithPagela > 0) {
      // Já passou o dia (ou semana passada) e algumas crianças têm pagela
      status = 'partial';
    } else {
      // Já passou o dia (ou semana passada) e nenhuma criança tem pagela
      status = 'missing';
    }

    // ⚠️ CRÍTICO: Indicadores SÓ são gerados se estiver DENTRO do período letivo
    // (se chegou aqui, está dentro do período e tem expectedDate)
    const indicators: any[] = [];
    
    // Calcular percentuais e estatísticas (só se estiver dentro do período)
    const completionRate = totalChildren > 0 ? (childrenWithPagela / totalChildren) * 100 : 0;
    const missingRate = totalChildren > 0 ? (childrenMissing / totalChildren) * 100 : 0;
    
    if (!exception) {
      if (status === 'ok') {
        // Só mostra indicador positivo se houver crianças no clube
        if (totalChildren > 0) {
        indicators.push({
          type: 'all_ok',
          severity: 'success',
          message: `✅ Todas as ${totalChildren} crianças tiveram pagela`,
            details: {
              totalChildren,
              childrenWithPagela,
              childrenMissing,
              completionRate: Math.round(completionRate * 10) / 10,
              missingRate: 0,
              isPerfect: true,
            },
          });
        }
        // Se não há crianças, não mostra indicador (clube vazio)
      } else if (status === 'pending') {
        // Status 'pending' = pendente, mas ainda dentro do prazo (dia do clubinho ainda não passou)
        // Não mostra indicadores negativos porque ainda não está atrasado
        // Status 'pending' não tem indicadores - apenas informa que está pendente mas dentro do prazo
      } else if (status === 'partial') {
        // ⚠️ CRÍTICO: Só mostra indicador negativo se JÁ PASSOU o dia do clubinho
        // Se ainda não passou o dia, não mostra indicador negativo (não há como cobrar antes do evento)
        if (hasPassedClubDay) {
        indicators.push({
          type: 'some_missing',
          severity: 'warning',
            message: `⚠️ ${childrenMissing} de ${totalChildren} crianças SEM pagela (${Math.round(missingRate)}% faltando)`,
            details: {
              totalChildren,
              childrenWithPagela,
              childrenMissing,
              completionRate: Math.round(completionRate * 10) / 10,
              missingRate: Math.round(missingRate * 10) / 10,
              isPerfect: false,
              needsAttention: true,
              urgency: missingRate > 50 ? 'high' : missingRate > 25 ? 'medium' : 'low',
            },
          });
        }
        // Se ainda não passou o dia do clubinho, não mostra indicador negativo (status continua 'partial' mas sem indicador)
      } else if (status === 'missing') {
        // ⚠️ CRÍTICO: Só mostra indicador negativo se JÁ PASSOU o dia do clubinho
        // Se ainda não passou o dia, não mostra indicador negativo (não há como cobrar antes do evento)
        if (hasPassedClubDay) {
          if (totalChildren > 0) {
        indicators.push({
          type: 'no_pagela',
          severity: 'critical',
          message: `🔴 NENHUMA pagela registrada (${totalChildren} crianças esperadas)`,
              details: {
                totalChildren,
                childrenWithPagela: 0,
                childrenMissing,
                completionRate: 0,
                missingRate: 100,
                isPerfect: false,
                needsAttention: true,
                urgency: 'critical',
                lastPagelaDate: null,
              },
            });
          } else {
            // Se não há crianças mas status é missing, pode ser um erro de configuração
            indicators.push({
              type: 'no_children',
              severity: 'warning',
              message: `⚠️ Clube sem crianças cadastradas`,
              details: {
                totalChildren: 0,
                childrenWithPagela: 0,
                childrenMissing: 0,
                completionRate: 0,
                missingRate: 0,
                isPerfect: false,
                needsAttention: false,
                urgency: 'low',
                possibleIssue: 'Clube pode estar inativo ou sem configuração de crianças',
              },
            });
          }
        }
        // Se ainda não passou o dia do clubinho, não mostra indicador negativo (status continua 'missing' mas sem indicador)
      }
    } else {
      // Exceção sempre mostra indicador com detalhes
      indicators.push({
        type: 'exception',
        severity: 'info',
        message: `ℹ️ Exceção global: ${exception.reason}`,
        details: {
          exceptionDate: exception.exceptionDate,
          reason: exception.reason,
          type: exception.type,
          isRecurrent: exception.isRecurrent,
          totalChildren,
          childrenWithPagela,
          childrenMissing,
          note: 'Pagelas não são obrigatórias nesta data devido à exceção cadastrada',
        },
      });
    }

    return {
      clubId: club.id,
      clubNumber: club.number,
      weekday: club.weekday,
      week: {
        year,
        week,
        expectedDate,
      },
      children: {
        total: totalChildren,
        activeCount: totalChildren,
        inactiveCount: inactiveCount,
        withPagela: childrenWithPagela,
        missing: childrenMissing,
        missingList: childrenMissingList,
        note: "Apenas crianças ATIVAS e que já tinham entrado são consideradas",
      },
      status,
      indicators,
      exception: exception ? {
        date: exception.exceptionDate,
        reason: exception.reason,
        type: exception.type,
      } : null,
    };
  }

  /**
   * Verificar TODOS os clubes em uma semana
   */
  /**
   * Verificar todos os clubes em uma semana
   * 
   * ⚠️ IMPORTANTE: year e week são do ANO LETIVO, não semana ISO!
   * - year: Ano do período letivo (ex: 2024)
   * - week: Semana do ano letivo (semana 1 = primeira semana dentro do período letivo)
   * 
   * As pagelas são armazenadas com semana do ano letivo, então esses parâmetros
   * devem corresponder à semana do ano letivo, não à semana ISO do ano calendário.
   */
  async checkAllClubsWeek(year: number, week: number, page: number = 1, limit: number = 50): Promise<any> {
    // ✅ VERIFICAR PERÍODO LETIVO ANTES de processar clubes
    // year é o ano do período letivo, não ano calendário
    const period = await this.findPeriodByYear(year);
    
    // Se não há período letivo cadastrado, retorna clubs vazio
    if (!period) {
      const currentAcademicWeek = await this.calculateCurrentAcademicWeek();
      return {
        year,
        week,
        summary: {
          totalClubs: 0,
          clubsOk: 0,
          clubsPending: 0,
          clubsPartial: 0,
          clubsMissing: 0,
          clubsException: 0,
          clubsInactive: 0,
          clubsOutOfPeriod: 0,
        },
        clubs: [], // VAZIO quando não há período letivo
        pagination: {
          page,
          limit,
          total: 0,
          totalPages: 0,
          hasNextPage: false,
          hasPreviousPage: false,
        },
        currentWeek: currentAcademicWeek || {
          academicYear: null,
          academicWeek: null,
          isWithinPeriod: false,
          periodStartDate: null,
          periodEndDate: null,
        },
        note: 'Período letivo não cadastrado - nenhum clube retornado',
      };
    }

    // Verificar se a semana está dentro do período letivo
    // Calcula uma data da semana (segunda-feira da semana ISO) para verificar
    const weekStartDate = this.getDateOfISOWeek(year, week);
    const weekDates = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
    
    // Verificar se pelo menos um dia da semana está dentro do período
    let isWeekWithinPeriod = false;
    const periodStart = new Date(period.startDate);
    const periodEnd = new Date(period.endDate);
    
    for (const weekday of weekDates) {
      const expectedDate = this.getExpectedDateForWeek(year, week, weekday);
      const expectedDateObj = new Date(expectedDate);
      
      if (expectedDateObj >= periodStart && expectedDateObj <= periodEnd) {
        isWeekWithinPeriod = true;
        break;
      }
    }

    // Se a semana está FORA do período letivo, retorna clubs vazio
    if (!isWeekWithinPeriod) {
      const currentAcademicWeek = await this.calculateCurrentAcademicWeek();
      return {
        year,
        week,
        summary: {
          totalClubs: 0,
          clubsOk: 0,
          clubsPending: 0,
          clubsPartial: 0,
          clubsMissing: 0,
          clubsException: 0,
          clubsInactive: 0,
          clubsOutOfPeriod: 0,
        },
        clubs: [], // VAZIO quando está fora do período letivo
        pagination: {
          page,
          limit,
          total: 0,
          totalPages: 0,
          hasNextPage: false,
          hasPreviousPage: false,
        },
        currentWeek: currentAcademicWeek || {
          academicYear: period.year,
          academicWeek: null,
          isWithinPeriod: false,
          periodStartDate: period.startDate,
          periodEndDate: period.endDate,
        },
        period: {
          year: period.year,
          startDate: period.startDate,
          endDate: period.endDate,
        },
        note: `Semana fora do período letivo (${new Date(period.startDate).toLocaleDateString('pt-BR')} a ${new Date(period.endDate).toLocaleDateString('pt-BR')}) - nenhum clube retornado`,
      };
    }

    // Se chegou aqui, está dentro do período letivo - processar clubes normalmente
    const clubs = await this.clubsRepository.find();

    const clubsResults = await Promise.all(
      clubs.map((club) => this.checkClubWeek(club.id, year, week)),
    );

    // ✅ ORDENAR: Clubes com indicadores negativos primeiro
    // Ordem de prioridade: missing > partial > exception > inactive > out_of_period > pending > ok
    const statusPriority: Record<string, number> = {
      'missing': 1,      // Mais crítico - aparece primeiro
      'partial': 2,      // Crítico - aparece segundo
      'exception': 3,    // Informativo
      'inactive': 4,     // Informativo
      'out_of_period': 5, // Informativo
      'pending': 6,      // Pendente mas dentro do prazo - aparece antes de OK
      'ok': 7,           // OK - aparece por último
    };

    // Ordenar clubes: primeiro os com problemas (indicadores negativos)
    clubsResults.sort((a, b) => {
      const priorityA = statusPriority[a.status] || 99;
      const priorityB = statusPriority[b.status] || 99;
      
      // Primeiro: ordenar por prioridade de status
      if (priorityA !== priorityB) {
        return priorityA - priorityB;
      }
      
      // Segundo: se mesmo status, ordenar por número do clube
      return a.clubNumber - b.clubNumber;
    });

    // Resumo geral
    const summary = {
      totalClubs: clubs.length,
      clubsOk: clubsResults.filter((r) => r.status === 'ok').length,
      clubsPending: clubsResults.filter((r) => r.status === 'pending').length,
      clubsPartial: clubsResults.filter((r) => r.status === 'partial').length,
      clubsMissing: clubsResults.filter((r) => r.status === 'missing').length,
      clubsException: clubsResults.filter((r) => r.status === 'exception').length,
      clubsInactive: clubsResults.filter((r) => r.status === 'inactive').length,
      clubsOutOfPeriod: clubsResults.filter((r) => r.status === 'out_of_period').length,
    };

    // Pagination on clubs list (já ordenada)
    // ⭐ SEMPRE aplicar paginação (usando valores padrão se não fornecidos)
    const total = clubsResults.length;
      const start = (page - 1) * limit;
      const end = start + limit;
    const pagedClubs = clubsResults.slice(start, end);
    const pagination = {
        page,
        limit,
        total,
        totalPages: Math.max(1, Math.ceil(total / limit)),
      hasNextPage: end < total,
      hasPreviousPage: start > 0,
      };

    // Buscar informação da semana atual do ano letivo
    const currentAcademicWeek = await this.calculateCurrentAcademicWeek();

    return {
      year,
      week,
      summary,
      clubs: pagedClubs,
      pagination,
      currentWeek: currentAcademicWeek,
    };
  }

  /**
   * Análise detalhada dos indicadores de uma semana
   * Retorna informações completas sobre todos os indicadores, problemas e recomendações
   * 
   * Filtros disponíveis:
   * - status: Filtrar por status
   * - severity: Filtrar por severidade
   * - weekday: Filtrar por dia da semana
   * - indicatorType: Filtrar por tipo de indicador
   * - hasProblems: Apenas clubes com problemas
   * - page: Página para paginação
   * - limit: Limite por página
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
  ): Promise<any> {
    const clubs = await this.clubsRepository.find();
    
    // Obter todos os resultados dos clubes
    let clubsResults = await Promise.all(
      clubs.map((club) => this.checkClubWeek(club.id, year, week)),
    );

    // Aplicar filtros
    if (filters) {
      if (filters.status) {
        clubsResults = clubsResults.filter(r => r.status === filters.status);
      }

      if (filters.weekday) {
        clubsResults = clubsResults.filter(r => 
          r.weekday?.toLowerCase() === filters.weekday?.toLowerCase()
        );
      }

      if (filters.hasProblems !== undefined) {
        if (filters.hasProblems) {
          clubsResults = clubsResults.filter(r => {
            const hasCritical = r.indicators?.some((i: any) => i.severity === 'critical');
            const hasWarning = r.indicators?.some((i: any) => i.severity === 'warning');
            return hasCritical || hasWarning || r.status === 'partial' || r.status === 'missing';
          });
        } else {
          clubsResults = clubsResults.filter(r => r.status === 'ok');
        }
      }

      if (filters.severity) {
        clubsResults = clubsResults.filter(r => 
          r.indicators?.some((i: any) => i.severity === filters.severity)
        );
      }

      if (filters.indicatorType) {
        clubsResults = clubsResults.filter(r => 
          r.indicators?.some((i: any) => i.type === filters.indicatorType)
        );
      }
    }

    // Agrupar por tipo de indicador e status
    const indicatorsByType: Record<string, any[]> = {
      all_ok: [],
      some_missing: [],
      no_pagela: [],
      no_children: [],
      exception: [],
      no_weekday: [],
      out_of_period: [],
    };

    const clubsByStatus: Record<string, any[]> = {
      ok: [],
      partial: [],
      missing: [],
      exception: [],
      inactive: [],
      out_of_period: [],
    };

    // Estatísticas agregadas
    let totalChildrenAll = 0;
    let totalChildrenWithPagela = 0;
    let totalChildrenMissing = 0;
    const clubsWithProblems: any[] = [];
    const clubsCritical: any[] = [];
    const clubsWarning: any[] = [];

    clubsResults.forEach((result) => {
      // Agrupar por status
      if (!clubsByStatus[result.status]) {
        clubsByStatus[result.status] = [];
      }
      clubsByStatus[result.status].push(result);

      // Processar indicadores
      if (result.indicators && result.indicators.length > 0) {
        result.indicators.forEach((indicator: any) => {
          const type = indicator.type;
          if (indicatorsByType[type]) {
            indicatorsByType[type].push({
              clubId: result.clubId,
              clubNumber: result.clubNumber,
              weekday: result.weekday,
              indicator,
              children: result.children,
              week: result.week,
            });
          }
        });

        // Identificar problemas críticos
        const hasCritical = result.indicators.some((i: any) => i.severity === 'critical');
        const hasWarning = result.indicators.some((i: any) => i.severity === 'warning');

        if (hasCritical) {
          clubsCritical.push(result);
          clubsWithProblems.push(result);
        } else if (hasWarning) {
          clubsWarning.push(result);
          clubsWithProblems.push(result);
        }
      }

      // Acumular estatísticas
      totalChildrenAll += result.children.total || 0;
      totalChildrenWithPagela += result.children.withPagela || 0;
      totalChildrenMissing += result.children.missing || 0;
    });

    // Calcular percentuais gerais
    const overallCompletionRate = totalChildrenAll > 0 
      ? (totalChildrenWithPagela / totalChildrenAll) * 100 
      : 0;
    const overallMissingRate = totalChildrenAll > 0 
      ? (totalChildrenMissing / totalChildrenAll) * 100 
      : 0;

    // Calcular estatísticas por dia da semana
    const statsByWeekday: Record<string, any> = {};
    clubsResults.forEach((result) => {
      if (result.weekday) {
        if (!statsByWeekday[result.weekday]) {
          statsByWeekday[result.weekday] = {
            weekday: result.weekday,
            totalClubs: 0,
            clubsOk: 0,
            clubsPending: 0,
            clubsPartial: 0,
            clubsMissing: 0,
            totalChildren: 0,
            childrenWithPagela: 0,
            childrenMissing: 0,
            completionRate: 0,
          };
        }
        const stats = statsByWeekday[result.weekday];
        stats.totalClubs++;
        if (result.status === 'ok') stats.clubsOk++;
        if (result.status === 'pending') stats.clubsPending = (stats.clubsPending || 0) + 1;
        if (result.status === 'partial') stats.clubsPartial++;
        if (result.status === 'missing') stats.clubsMissing++;
        stats.totalChildren += result.children.total || 0;
        stats.childrenWithPagela += result.children.withPagela || 0;
        stats.childrenMissing += result.children.missing || 0;
        stats.completionRate = stats.totalChildren > 0 
          ? (stats.childrenWithPagela / stats.totalChildren) * 100 
          : 0;
      }
    });

    // Gerar recomendações
    const recommendations: string[] = [];
    
    if (clubsCritical.length > 0) {
      recommendations.push(`🚨 ATENÇÃO: ${clubsCritical.length} clube(s) com problemas críticos precisam de atenção imediata`);
    }
    
    if (clubsWarning.length > 0) {
      recommendations.push(`⚠️ ${clubsWarning.length} clube(s) com avisos requerem atenção`);
    }

    if (overallMissingRate > 20) {
      recommendations.push(`📊 Taxa de faltantes alta (${Math.round(overallMissingRate)}%). Considere verificar as causas`);
    }

    if (indicatorsByType.no_pagela.length > 0) {
      recommendations.push(`🔴 ${indicatorsByType.no_pagela.length} clube(s) sem nenhuma pagela registrada nesta semana`);
    }

    if (indicatorsByType.some_missing.length > 0) {
      recommendations.push(`⚠️ ${indicatorsByType.some_missing.length} clube(s) com pagelas parciais - algumas crianças faltando`);
    }

    // Resumo executivo
    const executiveSummary = {
      week: {
        year,
        week,
        expectedDate: clubsResults[0]?.week?.expectedDate || null,
      },
      overall: {
        totalClubs: clubs.length,
        clubsOk: clubsByStatus.ok?.length || 0,
        clubsPending: clubsByStatus.pending?.length || 0,
        clubsPartial: clubsByStatus.partial?.length || 0,
        clubsMissing: clubsByStatus.missing?.length || 0,
        clubsException: clubsByStatus.exception?.length || 0,
        clubsInactive: clubsByStatus.inactive?.length || 0,
        clubsOutOfPeriod: clubsByStatus.out_of_period?.length || 0,
        clubsWithProblems: clubsWithProblems.length,
        clubsCritical: clubsCritical.length,
        clubsWarning: clubsWarning.length,
      },
      children: {
        total: totalChildrenAll,
        withPagela: totalChildrenWithPagela,
        missing: totalChildrenMissing,
        completionRate: Math.round(overallCompletionRate * 10) / 10,
        missingRate: Math.round(overallMissingRate * 10) / 10,
      },
      indicators: {
        total: clubsResults.reduce((sum, r) => sum + (r.indicators?.length || 0), 0),
        byType: Object.keys(indicatorsByType).reduce((acc, key) => {
          acc[key] = indicatorsByType[key].length;
          return acc;
        }, {} as Record<string, number>),
        bySeverity: {
          critical: clubsResults.filter(r => 
            r.indicators?.some((i: any) => i.severity === 'critical')
          ).length,
          warning: clubsResults.filter(r => 
            r.indicators?.some((i: any) => i.severity === 'warning')
          ).length,
          info: clubsResults.filter(r => 
            r.indicators?.some((i: any) => i.severity === 'info')
          ).length,
          success: clubsResults.filter(r => 
            r.indicators?.some((i: any) => i.severity === 'success')
          ).length,
        },
      },
    };

    return {
      executiveSummary,
      indicators: {
        byType: indicatorsByType,
        critical: indicatorsByType.no_pagela.map((item: any) => ({
          clubId: item.clubId,
          clubNumber: item.clubNumber,
          weekday: item.weekday,
          indicator: item.indicator,
          children: item.children,
        })),
        warning: [
          ...indicatorsByType.some_missing,
          ...indicatorsByType.no_children,
        ].map((item: any) => ({
          clubId: item.clubId,
          clubNumber: item.clubNumber,
          weekday: item.weekday,
          indicator: item.indicator,
          children: item.children,
        })),
      },
      clubs: {
        byStatus: clubsByStatus,
        withProblems: clubsWithProblems.map(c => ({
          clubId: c.clubId,
          clubNumber: c.clubNumber,
          weekday: c.weekday,
          status: c.status,
          indicators: c.indicators,
          children: c.children,
          week: c.week,
        })),
        critical: clubsCritical.map(c => ({
          clubId: c.clubId,
          clubNumber: c.clubNumber,
          weekday: c.weekday,
          status: c.status,
          indicators: c.indicators,
          children: c.children,
          week: c.week,
        })),
      },
      statistics: {
        byWeekday: Object.values(statsByWeekday),
        overall: {
          completionRate: Math.round(overallCompletionRate * 10) / 10,
          missingRate: Math.round(overallMissingRate * 10) / 10,
          problemsRate: clubs.length > 0 
            ? Math.round((clubsWithProblems.length / clubs.length) * 100 * 10) / 10 
            : 0,
        },
      },
      recommendations,
      currentWeek: await this.calculateCurrentAcademicWeek(),
      // Aplicar paginação se especificado
      ...(filters?.page && filters?.limit ? {
        pagination: {
          page: filters.page,
          limit: filters.limit,
          total: clubsWithProblems.length,
          totalPages: Math.ceil(clubsWithProblems.length / filters.limit),
          hasNextPage: (filters.page * filters.limit) < clubsWithProblems.length,
          hasPreviousPage: filters.page > 1,
        },
        clubsWithProblems: clubsWithProblems.slice(
          (filters.page - 1) * filters.limit,
          filters.page * filters.limit
        ),
        clubsCritical: clubsCritical.slice(
          (filters.page - 1) * filters.limit,
          filters.page * filters.limit
        ),
      } : {}),
    };
  }

  // ============= HELPERS =============

  /**
   * Calcular a semana atual do ano letivo
   */
  async calculateCurrentAcademicWeek(): Promise<{
    academicYear: number | null;
    academicWeek: number | null;
    isWithinPeriod: boolean;
    periodStartDate: string | null;
    periodEndDate: string | null;
  } | null> {
    const now = new Date();
    const currentYear = now.getFullYear();
    const period = await this.findPeriodByYear(currentYear);
    
    if (!period) {
      return {
        academicYear: null,
        academicWeek: null,
        isWithinPeriod: false,
        periodStartDate: null,
        periodEndDate: null,
      };
    }

    const startDate = new Date(period.startDate + 'T00:00:00');
    const endDate = new Date(period.endDate + 'T23:59:59');
    const nowDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const nowDateStr = nowDate.toISOString().split('T')[0];
    
    if (nowDate < startDate || nowDate > endDate) {
      return {
        academicYear: period.year,
        academicWeek: 0,
        isWithinPeriod: false,
        periodStartDate: period.startDate,
        periodEndDate: period.endDate,
      };
    }

    // ✅ Usar getAcademicWeekYear para calcular a semana do ano letivo
    // Esta função já está implementada corretamente e é usada em outros lugares
    try {
      const weekData = getAcademicWeekYear(
        nowDateStr,
        period.startDate,
        period.endDate,
        period.year
      );
      
      const result = {
        academicYear: weekData.year,
        academicWeek: weekData.week,
        isWithinPeriod: true,
        periodStartDate: period.startDate,
        periodEndDate: period.endDate,
      };
      
      return result;
    } catch (error) {
      // Se houver erro (data fora do período), retornar como fora do período
      return {
        academicYear: period.year,
        academicWeek: 0,
        isWithinPeriod: false,
        periodStartDate: period.startDate,
        periodEndDate: period.endDate,
      };
    }
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
   * Calcula a data esperada baseada na semana ACADÊMICA (não ISO)
   * @param year - Ano do período letivo
   * @param week - Semana acadêmica (1-N)
   * @param weekday - Dia da semana do clube
   * @param period - Período letivo
   * @returns Data no formato YYYY-MM-DD
   */
  private getExpectedDateForAcademicWeek(year: number, week: number, weekday: string, period: ClubPeriodEntity): string {
    const weekdayMap: Record<string, number> = {
      monday: 1,
      tuesday: 2,
      wednesday: 3,
      thursday: 4,
      friday: 5,
      saturday: 6,
      sunday: 0,
    };

    const targetWeekday = weekdayMap[weekday?.toLowerCase()];
    
    if (targetWeekday === undefined) {
      throw new Error(`Invalid weekday: ${weekday}`);
    }

    // ✅ Calcular baseado na semana ACADÊMICA:
    // 1. Obter o início do período letivo
    // 2. Calcular o início da semana acadêmica N
    // 3. Encontrar o dia da semana específico dentro dessa semana
    
    const periodStartDate = new Date(period.startDate + 'T00:00:00');
    const startWeekStart = this.getWeekStartDate(periodStartDate);
    
    // Calcular o início da semana acadêmica N (semana 1 = startWeekStart)
    // Semana 1: startWeekStart
    // Semana 2: startWeekStart + 7 dias
    // Semana N: startWeekStart + (N-1) * 7 dias
    const academicWeekStart = new Date(startWeekStart);
    academicWeekStart.setDate(startWeekStart.getDate() + (week - 1) * 7);
    
    // Encontrar o dia da semana específico dentro dessa semana acadêmica
    const date = new Date(academicWeekStart);
    const currentDay = date.getDay();
    
    // Calcular diferença para chegar ao dia desejado
    // Se dia atual é segunda (1) e queremos sábado (6): +5 dias
    // Se dia atual é segunda (1) e queremos terça (2): +1 dia
    let dayDiff = targetWeekday - currentDay;
    if (dayDiff < 0) {
      dayDiff += 7; // Ajustar para próxima ocorrência
    }
    
    date.setDate(academicWeekStart.getDate() + dayDiff);

    const resultDate = date.toISOString().split('T')[0];
    
    return resultDate;
  }

  /**
   * @deprecated Usar getExpectedDateForAcademicWeek - calcula baseado em semana ISO (incorreto)
   */
  private getExpectedDateForWeek(year: number, week: number, weekday: string): string {
    const weekdayMap: Record<string, number> = {
      monday: 1,
      tuesday: 2,
      wednesday: 3,
      thursday: 4,
      friday: 5,
      saturday: 6,
      sunday: 0,
    };

    const targetWeekday = weekdayMap[weekday?.toLowerCase()];
    
    if (targetWeekday === undefined) {
      throw new Error(`Invalid weekday: ${weekday}`);
    }

    const date = this.getDateOfISOWeek(year, week);

    // Ajustar para o dia da semana desejado (máximo 7 iterações)
    let iterations = 0;
    while (date.getDay() !== targetWeekday && iterations < 7) {
      date.setDate(date.getDate() + 1);
      iterations++;
    }

    if (iterations === 7) {
      throw new Error(`Could not calculate date for year=${year}, week=${week}, weekday=${weekday}`);
    }

    return date.toISOString().split('T')[0];
  }

  private getDateOfISOWeek(year: number, week: number): Date {
    const simple = new Date(year, 0, 1 + (week - 1) * 7);
    const dow = simple.getDay();
    const ISOweekStart = simple;
    if (dow <= 4) {
      ISOweekStart.setDate(simple.getDate() - simple.getDay() + 1);
    } else {
      ISOweekStart.setDate(simple.getDate() + 8 - simple.getDay());
    }
    return ISOweekStart;
  }
}
