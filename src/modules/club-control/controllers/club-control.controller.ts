import { Controller, Get, Post, Body, Param, Query, Delete, NotFoundException, Logger } from '@nestjs/common';
import { ClubControlService } from '../services/club-control.service';
import { CreateClubPeriodDto } from '../dto/create-club-period.dto';
import { CreateClubExceptionDto } from '../dto/create-club-exception.dto';

/**
 * Controlador de Controle GLOBAL dos Clubes
 * 
 * IMPORTANTE:
 * - Períodos letivos são GLOBAIS (um por ano)
 * - Exceções são GLOBAIS (uma por data, afeta todos os clubes)
 * - Verificações são em tempo real pelo painel
 */
@Controller('club-control')
export class ClubControlController {
  private readonly logger = new Logger(ClubControlController.name);

  constructor(private readonly clubControlService: ClubControlService) {}

  // ============= PERÍODOS LETIVOS GLOBAIS =============

  /**
   * POST /club-control/periods
   * 
   * Criar período letivo GLOBAL (um por ano para todos os clubes)
   * 
   * Body:
   * {
   *   "year": 2024,
   *   "startDate": "2024-02-05",
   *   "endDate": "2024-12-15",
   *   "description": "Ano Letivo 2024"
   * }
   * 
   * REGRA: A primeira semana dentro do período é a "semana 1" do ano letivo
   */
  @Post('periods')
  async createPeriod(@Body() dto: CreateClubPeriodDto) {
    const started = Date.now();
    this.logger.log(`POST /club-control/periods dto=${JSON.stringify(dto)}`);
    try {
      const result = await this.clubControlService.createPeriod(dto);
      this.logger.log(`POST /club-control/periods -> success in ${Date.now() - started}ms id=${result?.id ?? 'n/a'}`);
      return result;
    } catch (err: any) {
      this.logger.error(`POST /club-control/periods -> error in ${Date.now() - started}ms: ${err?.message}`);
      throw err;
    }
  }

  /**
   * GET /club-control/periods/:year
   * 
   * Buscar período letivo de um ano específico
   */
  @Get('periods/:year')
  async getPeriodByYear(@Param('year') year: number) {
    const started = Date.now();
    this.logger.log(`GET /club-control/periods/${year}`);
    try {
      const result = await this.clubControlService.getPeriodByYear(Number(year));
      this.logger.log(`GET /club-control/periods/${year} -> success in ${Date.now() - started}ms found=${!!result}`);
      return result;
    } catch (err: any) {
      this.logger.error(`GET /club-control/periods/${year} -> error in ${Date.now() - started}ms: ${err?.message}`);
      throw err;
    }
  }

  /**
   * GET /club-control/periods
   * 
   * Listar todos os períodos letivos
   */
  @Get('periods')
  async getAllPeriods(
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ) {
    const started = Date.now();
    const p = page ? Number(page) : undefined;
    const l = limit ? Number(limit) : undefined;
    this.logger.log(`GET /club-control/periods?page=${p ?? ''}&limit=${l ?? ''}`);
    try {
      const result = await this.clubControlService.getAllPeriods(p, l);
      const count = Array.isArray((result as any)?.items) ? (result as any).items.length : 0;
      this.logger.log(`GET /club-control/periods -> success in ${Date.now() - started}ms count=${count}`);
      return result;
    } catch (err: any) {
      this.logger.error(`GET /club-control/periods -> error in ${Date.now() - started}ms: ${err?.message}`);
      throw err;
    }
  }

  /**
   * DELETE /club-control/periods/:id
   * 
   * Desativar (soft delete) um período letivo pelo ID
   */
  @Delete('periods/:id')
  async deletePeriod(@Param('id') id: string) {
    const started = Date.now();
    this.logger.log(`DELETE /club-control/periods/${id}`);
    try {
      const result = await this.clubControlService.deletePeriod(id);
      if (!result?.success) {
        this.logger.warn(`DELETE /club-control/periods/${id} -> not found in ${Date.now() - started}ms`);
        throw new NotFoundException('Period not found');
      }
      this.logger.log(`DELETE /club-control/periods/${id} -> success in ${Date.now() - started}ms`);
      return { success: true };
    } catch (err: any) {
      if (!(err instanceof NotFoundException)) {
        this.logger.error(`DELETE /club-control/periods/${id} -> error in ${Date.now() - started}ms: ${err?.message}`);
      }
      throw err;
    }
  }

  // ============= EXCEÇÕES GLOBAIS =============

  /**
   * POST /club-control/exceptions
   * 
   * Criar exceção GLOBAL (uma por data, afeta todos os clubes)
   * 
   * Body:
   * {
   *   "exceptionDate": "2024-11-15",
   *   "reason": "Feriado - Proclamação da República",
   *   "type": "holiday",
   *   "isRecurrent": true
   * }
   * 
   * REGRA: Se 15/11/2024 é uma quarta-feira, TODOS os clubes de quarta
   * não funcionam nesse dia (não precisam de pagela)
   */
  @Post('exceptions')
  async createException(@Body() dto: CreateClubExceptionDto) {
    const started = Date.now();
    this.logger.log(`POST /club-control/exceptions dto=${JSON.stringify(dto)}`);
    try {
      const result = await this.clubControlService.createException(dto);
      this.logger.log(`POST /club-control/exceptions -> success in ${Date.now() - started}ms id=${result?.id ?? 'n/a'}`);
      return result;
    } catch (err: any) {
      this.logger.error(`POST /club-control/exceptions -> error in ${Date.now() - started}ms: ${err?.message}`);
      throw err;
    }
  }

  /**
   * GET /club-control/exceptions/:date
   * 
   * Buscar exceção por data específica
   * 
   * Exemplo: /club-control/exceptions/2024-11-15
   */
  @Get('exceptions/:date')
  async getExceptionByDate(@Param('date') date: string) {
    const started = Date.now();
    this.logger.log(`GET /club-control/exceptions/${date}`);
    try {
      const result = await this.clubControlService.getExceptionByDate(date);
      this.logger.log(`GET /club-control/exceptions/${date} -> success in ${Date.now() - started}ms found=${!!result}`);
      return result;
    } catch (err: any) {
      this.logger.error(`GET /club-control/exceptions/${date} -> error in ${Date.now() - started}ms: ${err?.message}`);
      throw err;
    }
  }

  /**
   * GET /club-control/exceptions
   * 
   * Listar exceções (opcionalmente filtrar por período)
   * 
   * Query params: startDate, endDate
   * 
   * Exemplo: /club-control/exceptions?startDate=2024-01-01&endDate=2024-12-31
   */
  @Get('exceptions')
  async getExceptionsByPeriod(
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ) {
    const started = Date.now();
    const p = page ? Number(page) : undefined;
    const l = limit ? Number(limit) : undefined;
    this.logger.log(`GET /club-control/exceptions?startDate=${startDate ?? ''}&endDate=${endDate ?? ''}&page=${p ?? ''}&limit=${l ?? ''}`);
    try {
      const result = await this.clubControlService.getExceptionsByPeriod(startDate, endDate, p, l);
      const count = Array.isArray((result as any)?.items) ? (result as any).items.length : 0;
      this.logger.log(`GET /club-control/exceptions -> success in ${Date.now() - started}ms count=${count}`);
      return result;
    } catch (err: any) {
      this.logger.error(`GET /club-control/exceptions -> error in ${Date.now() - started}ms: ${err?.message}`);
      throw err;
    }
  }

  // ============= PAINEL DE CONTROLE (TEMPO REAL) =============

  /**
   * GET /club-control/check/club/:clubId
   * 
   * Verificar um clube específico em uma semana
   * 
   * Query params:
   * - year: ano (obrigatório)
   * - week: semana (obrigatório)
   * 
   * Retorna:
   * - Total de crianças
   * - Crianças com pagela
   * - Crianças SEM pagela (lista de nomes)
   * - Status: ok, partial, missing, exception
   * - Indicadores visuais para o painel
   * 
   * Exemplo: /club-control/check/club/uuid?year=2024&week=45
   */
  @Get('check/club/:clubId')
  async checkClubWeek(
    @Param('clubId') clubId: string,
    @Query('year') year: number,
    @Query('week') week: number,
  ) {
    const started = Date.now();
    this.logger.log(`GET /club-control/check/club/${clubId}?year=${year}&week=${week}`);
    try {
      const result = await this.clubControlService.checkClubWeek(clubId, Number(year), Number(week));
      this.logger.log(`GET /club-control/check/club/${clubId} -> success in ${Date.now() - started}ms status=${result?.status}`);
      return result;
    } catch (err: any) {
      this.logger.error(`GET /club-control/check/club/${clubId} -> error in ${Date.now() - started}ms: ${err?.message}`);
      throw err;
    }
  }

  /**
   * GET /club-control/check/week
   * 
   * Verificar TODOS os clubes em uma semana
   * 
   * ⚠️ IMPORTANTE: year e week são do ANO LETIVO, não semana ISO!
   * - year: Ano do período letivo (ex: 2024)
   * - week: Semana do ano letivo (semana 1 = primeira semana dentro do período letivo)
   * 
   * As pagelas são armazenadas com semana do ano letivo.
   * 
   * ⭐ NOVO: Se `year` e `week` não forem fornecidos, o sistema calcula automaticamente
   * a semana atual do ano letivo baseado no período letivo cadastrado!
   * 
   * Query params:
   * - year: ano do período letivo (OPCIONAL - se não informado, usa semana atual)
   * - week: semana do ano letivo (OPCIONAL - se não informado, usa semana atual)
   * - page: página para paginação (opcional)
   * - limit: limite por página (opcional)
   * 
   * Retorna:
   * - Lista de todos os clubes
   * - Status de cada um
   * - Crianças faltantes por clube
   * - Resumo geral (quantos ok, partial, missing, exception)
   * - Informação da semana atual (`currentWeek`)
   * 
   * Ideal para dashboard semanal do administrador
   * 
   * Exemplos:
   * - /club-control/check/week (sem parâmetros - retorna semana atual)
   * - /club-control/check/week?year=2025&week=47 (semana específica)
   * - /club-control/check/week?year=2025&week=47&page=1&limit=20 (com paginação)
   */
  @Get('check/week')
  async checkAllClubsWeek(
    @Query('year') year?: number,
    @Query('week') week?: number,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ) {
    const started = Date.now();
    // ⭐ Valores padrão para paginação quando não fornecidos
    const DEFAULT_PAGE = 1;
    const DEFAULT_LIMIT = 50;
    const p = page ? Number(page) : DEFAULT_PAGE;
    const l = limit ? Number(limit) : DEFAULT_LIMIT;
    
    // Se year e week não foram fornecidos, calcular automaticamente a semana atual
    let y: number | undefined;
    let w: number | undefined;
    
    if (year !== undefined && week !== undefined) {
      // Parâmetros fornecidos - usar diretamente
      y = Number(year);
      w = Number(week);
      this.logger.log(`GET /club-control/check/week?year=${y}&week=${w}&page=${p}&limit=${l}`);
    } else {
      // Sem parâmetros - calcular semana atual automaticamente
      this.logger.log(`GET /club-control/check/week (calculando semana atual automaticamente, page=${p}, limit=${l})`);
    }
    
    try {
      const result = await this.clubControlService.checkAllClubsWeek(y, w, p, l);
      const listed = Array.isArray((result as any)?.clubs) ? (result as any).clubs.length : 0;
      this.logger.log(`GET /club-control/check/week -> success in ${Date.now() - started}ms clubsListed=${listed} total=${(result as any)?.summary?.totalClubs ?? 0} year=${(result as any)?.year} week=${(result as any)?.week}`);
      return result;
    } catch (err: any) {
      this.logger.error(`GET /club-control/check/week -> error in ${Date.now() - started}ms: ${err?.message}`);
      throw err;
    }
  }

  /**
   * GET /club-control/dashboard
   * 
   * Dashboard de controle da semana ATUAL
   * Não requer parâmetros - sempre mostra a semana atual
   * 
   * Retorna:
   * - Status de todos os clubes na semana corrente
   * - Indicadores visuais (✅ ⚠️ 🔴 ℹ️)
   * - Resumo geral
   * - Informação da semana atual do ano letivo
   * 
   * IMPORTANTE: Não envia alertas automáticos!
   * É apenas para consulta em tempo real pelo administrador.
   */
  @Get('dashboard')
  async getCurrentWeekDashboard() {
    const started = Date.now();
    this.logger.log(`GET /club-control/dashboard`);
    try {
      const result = await this.clubControlService.getCurrentWeekDashboard();
      this.logger.log(`GET /club-control/dashboard -> success in ${Date.now() - started}ms clubs=${result?.summary?.totalClubs ?? 0}`);
      return result;
    } catch (err: any) {
      this.logger.error(`GET /club-control/dashboard -> error in ${Date.now() - started}ms: ${err?.message}`);
      throw err;
    }
  }

  /**
   * GET /club-control/current-week
   * 
   * Obter informação da semana atual do ano letivo
   * 
   * Retorna:
   * - Ano letivo atual
   * - Número da semana atual (baseado no período letivo cadastrado)
   * - Se está dentro do período letivo
   * - Datas de início e fim do período letivo
   * 
   * IMPORTANTE: O número da semana é calculado baseado no período letivo cadastrado.
   * A primeira semana dentro do período é a "semana 1" do ano letivo.
   * 
   * Exemplo: /club-control/current-week
   */
  @Get('current-week')
  async getCurrentWeek() {
    const started = Date.now();
    this.logger.log(`GET /club-control/current-week`);
    try {
      const result = await this.clubControlService.getCurrentAcademicWeek();
      this.logger.log(`GET /club-control/current-week -> success in ${Date.now() - started}ms`);
      return result;
    } catch (err: any) {
      this.logger.error(`GET /club-control/current-week -> error in ${Date.now() - started}ms: ${err?.message}`);
      throw err;
    }
  }

  /**
   * GET /club-control/indicators/detailed
   * 
   * Análise detalhada dos indicadores de uma semana
   * 
   * ⚠️ IMPORTANTE: year e week são do ANO LETIVO, não semana ISO!
   * - year: Ano do período letivo (ex: 2024)
   * - week: Semana do ano letivo (semana 1 = primeira semana dentro do período letivo)
   * 
   * As pagelas são armazenadas com semana do ano letivo. Use o endpoint
   * /club-control/current-week para obter a semana atual do ano letivo.
   * 
   * Query params obrigatórios:
   * - year: ano do período letivo (obrigatório)
   * - week: semana do ano letivo (obrigatório)
   * 
   * Query params opcionais (filtros):
   * - status: Filtrar por status (ok, partial, missing, exception, inactive, out_of_period)
   * - severity: Filtrar por severidade (critical, warning, info, success)
   * - weekday: Filtrar por dia da semana (monday, tuesday, wednesday, thursday, friday, saturday)
   * - indicatorType: Filtrar por tipo de indicador (all_ok, some_missing, no_pagela, etc.)
   * - hasProblems: Apenas clubes com problemas (true/false)
   * - page: Página para paginação (default: 1)
   * - limit: Limite por página (default: 50)
   * 
   * Retorna:
   * - Resumo executivo completo
   * - Indicadores agrupados por tipo e severidade
   * - Clubes com problemas (críticos e avisos)
   * - Estatísticas por dia da semana
   * - Recomendações automáticas
   * - Informação da semana atual do ano letivo
   * - Paginação (se page e limit forem especificados)
   * 
   * Ideal para:
   * - Dashboard administrativo detalhado
   * - Relatórios executivos
   * - Análise de tendências
   * - Identificação de problemas prioritários
   * 
   * Exemplos:
   * - /club-control/indicators/detailed?year=2025&week=47
   * - /club-control/indicators/detailed?year=2025&week=47&status=missing
   * - /club-control/indicators/detailed?year=2025&week=47&severity=critical
   * - /club-control/indicators/detailed?year=2025&week=47&hasProblems=true&page=1&limit=20
   * - /club-control/indicators/detailed?year=2025&week=47&weekday=saturday&indicatorType=no_pagela
   */
  @Get('indicators/detailed')
  async getDetailedIndicators(
    @Query('year') year: number,
    @Query('week') week: number,
    @Query('status') status?: string,
    @Query('severity') severity?: string,
    @Query('weekday') weekday?: string,
    @Query('indicatorType') indicatorType?: string,
    @Query('hasProblems') hasProblems?: string,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ) {
    const started = Date.now();
    const y = Number(year);
    const w = Number(week);
    const filters: any = {};
    
    if (status) filters.status = status;
    if (severity) filters.severity = severity;
    if (weekday) filters.weekday = weekday;
    if (indicatorType) filters.indicatorType = indicatorType;
    if (hasProblems !== undefined) filters.hasProblems = hasProblems === 'true';
    if (page) filters.page = Number(page);
    if (limit) filters.limit = Number(limit);

    this.logger.log(`GET /club-control/indicators/detailed?year=${y}&week=${w}&filters=${JSON.stringify(filters)}`);
    try {
      const result = await this.clubControlService.getDetailedIndicators(y, w, Object.keys(filters).length > 0 ? filters : undefined);
      const critical = result?.clubs?.critical?.length || 0;
      const warning = result?.clubs?.warning?.length || 0;
      this.logger.log(`GET /club-control/indicators/detailed -> success in ${Date.now() - started}ms critical=${critical} warning=${warning}`);
      return result;
    } catch (err: any) {
      this.logger.error(`GET /club-control/indicators/detailed -> error in ${Date.now() - started}ms: ${err?.message}`);
      throw err;
    }
  }
}
