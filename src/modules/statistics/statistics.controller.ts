import { Controller, Get, Query, Param, Logger } from '@nestjs/common';
import { StatisticsService } from './statistics.service';
import { PagelasStatsQueryDto } from './dto/pagelas-stats-query.dto';
import { AcceptedChristsStatsQueryDto } from './dto/accepted-christs-stats-query.dto';
import { ChildrenStatsQueryDto } from './dto/children-stats-query.dto';
import { ClubsStatsQueryDto } from './dto/clubs-stats-query.dto';
import { TeachersStatsQueryDto } from './dto/teachers-stats-query.dto';

@Controller('statistics')
export class StatisticsController {
  private readonly logger = new Logger(StatisticsController.name);

  constructor(private readonly statisticsService: StatisticsService) {}

  /**
   * ENDPOINT 1: GET /statistics/pagelas/charts
   *
   * Retorna dados de Pagelas otimizados para gráficos ricos
   *
   * Suporta filtros avançados:
   * - Tempo: year, week, startDate, endDate
   * - Entidades: clubId, teacherId, coordinatorId
   * - Demografia: gender, minAge, maxAge
   * - Atividades: onlyPresent, onlyDidMeditation, onlyRecitedVerse
   * - Agrupamento: groupBy (day, week, month, year)
   *
   * Retorna:
   * - timeSeries: séries temporais para gráficos de linha/área
   * - byGender: distribuição por gênero para gráficos de pizza/barra
   * - byAgeGroup: distribuição por faixa etária
   * - byClub: comparação entre clubes
   * - byTeacher: ranking de professores
   *
   * Exemplos de uso:
   * - ?startDate=2024-01-01&endDate=2024-12-31&groupBy=month
   * - ?clubId=123&gender=F&minAge=6&maxAge=12
   * - ?teacherId=456&year=2024&onlyPresent=true
   */
  @Get('pagelas/charts')
  async getPagelasChartData(@Query() filters: PagelasStatsQueryDto) {
    const started = Date.now();
    this.logger.log(
      `GET /statistics/pagelas/charts filters=${JSON.stringify(filters)}`,
    );
    try {
      const result = await this.statisticsService.getPagelasChartData(filters);
      this.logger.log(
        `GET /statistics/pagelas/charts -> success in ${Date.now() - started}ms`,
      );
      return result;
    } catch (err: unknown) {
      const error = err as { message?: string };
      this.logger.error(
        `GET /statistics/pagelas/charts -> error in ${Date.now() - started}ms: ${error?.message || 'Unknown error'}`,
      );
      throw err;
    }
  }

  /**
   * ENDPOINT 2: GET /statistics/accepted-christs/charts
   *
   * Retorna dados de Accepted Christs otimizados para visualizações
   *
   * Suporta filtros avançados:
   * - Tempo: startDate, endDate
   * - Entidades: clubId, coordinatorId
   * - Decisão: decision (ACCEPTED, RECONCILED)
   * - Demografia: gender, minAge, maxAge
   * - Agrupamento: groupBy (day, week, month, year)
   *
   * Retorna:
   * - timeSeries: séries temporais com dados empilhados (stacked)
   * - byGender: distribuição por gênero
   * - byAgeGroup: distribuição por faixa etária
   * - byClub: comparação entre clubes
   *
   * Exemplos de uso:
   * - ?startDate=2024-01-01&endDate=2024-12-31&groupBy=month
   * - ?clubId=123&decision=ACCEPTED
   * - ?gender=M&minAge=10&maxAge=15&groupBy=week
   */
  @Get('accepted-christs/charts')
  async getAcceptedChristsChartData(
    @Query() filters: AcceptedChristsStatsQueryDto,
  ) {
    const started = Date.now();
    this.logger.log(
      `GET /statistics/accepted-christs/charts filters=${JSON.stringify(filters)}`,
    );
    try {
      const result =
        await this.statisticsService.getAcceptedChristsChartData(filters);
      this.logger.log(
        `GET /statistics/accepted-christs/charts -> success in ${Date.now() - started}ms`,
      );
      return result;
    } catch (err: unknown) {
      const error = err as { message?: string };
      this.logger.error(
        `GET /statistics/accepted-christs/charts -> error in ${Date.now() - started}ms: ${error?.message || 'Unknown error'}`,
      );
      throw err;
    }
  }

  /**
   * ENDPOINT 3: GET /statistics/insights
   *
   * Retorna insights avançados e rankings
   *
   * Suporta todos os filtros de Pagelas e Accepted Christs
   * Query params podem ser prefixados com 'pagelas_' ou 'ac_' para separar filtros
   * Se não prefixados, filtros são aplicados a ambos
   *
   * Retorna:
   * - topEngagedChildren: crianças mais engajadas com score de 0-100
   * - clubRankings: ranking de clubes por performance
   *
   * Métricas de engajamento consideram:
   * - Taxa de presença (30%)
   * - Taxa de meditação (35%)
   * - Taxa de recitação de versículo (35%)
   *
   * Score de performance dos clubes considera:
   * - Taxa média de presença (30%)
   * - Taxa média de meditação (30%)
   * - Taxa de atividade de crianças (20%)
   * - Taxa de decisões por criança (20%)
   *
   * Exemplos de uso:
   * - ?pagelas_startDate=2024-01-01&pagelas_clubId=123
   * - ?ac_decision=ACCEPTED&pagelas_onlyPresent=true
   * - ?startDate=2024-01-01 (aplica a ambos)
   */
  @Get('insights')
  async getCombinedInsights(@Query() allFilters: any) {
    const started = Date.now();
    this.logger.log(
      `GET /statistics/insights filters=${JSON.stringify(allFilters)}`,
    );
    // Separate filters for pagelas and accepted-christs
    const pagelasFilters: PagelasStatsQueryDto = {};
    const acFilters: AcceptedChristsStatsQueryDto = {};

    // Extract and separate filters
    Object.keys(allFilters).forEach((key) => {
      if (key.startsWith('pagelas_')) {
        const cleanKey = key.replace('pagelas_', '');
        const value = allFilters[key];
        if (value !== undefined) {
          pagelasFilters[cleanKey] = value;
        }
      } else if (key.startsWith('ac_')) {
        const cleanKey = key.replace('ac_', '');
        acFilters[cleanKey] = allFilters[key];
      } else {
        // Apply to both if not prefixed
        pagelasFilters[key] = allFilters[key];
        acFilters[key] = allFilters[key];
      }
    });

    try {
      const result = await this.statisticsService.getCombinedInsights(
        pagelasFilters,
        acFilters,
      );
      this.logger.log(
        `GET /statistics/insights -> success in ${Date.now() - started}ms`,
      );
      return result;
    } catch (err: any) {
      this.logger.error(
        `GET /statistics/insights -> error in ${Date.now() - started}ms: ${err?.message}`,
      );
      throw err;
    }
  }

  /**
   * ENDPOINT EXTRA: GET /statistics/overview
   *
   * Dashboard geral com resumo do sistema
   * Não requer filtros - sempre retorna dados atuais
   *
   * Retorna:
   * - summary: totais gerais (crianças, clubes, professores)
   * - pagelas: estatísticas da semana, mês e últimas 6 semanas
   * - acceptedChrists: estatísticas da semana, mês, ano e últimos 6 meses
   *
   * Ideal para dashboard inicial
   */
  @Get('overview')
  async getOverviewStatistics() {
    const started = Date.now();
    this.logger.log(`GET /statistics/overview`);
    try {
      const result = await this.statisticsService.getOverviewStatistics();
      this.logger.log(
        `GET /statistics/overview -> success in ${Date.now() - started}ms`,
      );
      return result;
    } catch (err: any) {
      this.logger.error(
        `GET /statistics/overview -> error in ${Date.now() - started}ms: ${err?.message}`,
      );
      throw err;
    }
  }

  /**
   * ENDPOINT LEGACY: GET /statistics/pagelas
   *
   * Endpoint legado mantido para compatibilidade
   * Retorna dados detalhados de Pagelas com estatísticas semanais
   */
  @Get('pagelas')
  async getPagelasStatistics(@Query() filters: PagelasStatsQueryDto) {
    const started = Date.now();
    this.logger.log(
      `GET /statistics/pagelas filters=${JSON.stringify(filters)}`,
    );
    try {
      const result = await this.statisticsService.getPagelasStatistics(filters);
      this.logger.log(
        `GET /statistics/pagelas -> success in ${Date.now() - started}ms`,
      );
      return result;
    } catch (err: any) {
      this.logger.error(
        `GET /statistics/pagelas -> error in ${Date.now() - started}ms: ${err?.message}`,
      );
      throw err;
    }
  }

  /**
   * ENDPOINT LEGACY: GET /statistics/accepted-christs
   *
   * Endpoint legado mantido para compatibilidade
   * Retorna dados detalhados de Accepted Christs com períodos agrupados
   */
  @Get('accepted-christs')
  async getAcceptedChristsStatistics(
    @Query() filters: AcceptedChristsStatsQueryDto,
  ) {
    const started = Date.now();
    this.logger.log(
      `GET /statistics/accepted-christs filters=${JSON.stringify(filters)}`,
    );
    try {
      const result =
        await this.statisticsService.getAcceptedChristsStatistics(filters);
      this.logger.log(
        `GET /statistics/accepted-christs -> success in ${Date.now() - started}ms`,
      );
      return result;
    } catch (err: any) {
      this.logger.error(
        `GET /statistics/accepted-christs -> error in ${Date.now() - started}ms: ${err?.message}`,
      );
      throw err;
    }
  }

  // ============= SPECIFIC VIEWS ENDPOINTS =============

  /**
   * ENDPOINT: GET /statistics/children
   *
   * Lista de crianças com estatísticas detalhadas e filtros avançados
   *
   * Query Params - Filtros Demográficos:
   * - gender: gênero (M, F)
   * - minAge, maxAge: faixa etária
   * - ageGroup: faixa pré-definida ("0-5", "6-10", "11-15", "16+")
   *
   * Query Params - Filtros Geográficos:
   * - city: cidade
   * - state: estado
   * - district: bairro
   *
   * Query Params - Filtros de Entidade:
   * - clubId: clube específico
   * - teacherId: professor específico
   * - coordinatorId: coordenador específico
   *
   * Query Params - Filtros de Atividade:
   * - year: ano das pagelas
   * - startDate, endDate: período das pagelas
   * - minPagelas: mínimo de pagelas
   * - minPresenceRate: taxa mínima de presença (0-100)
   * - minEngagementScore: score mínimo (0-100)
   * - hasDecision: se tem decisão (true/false)
   * - decisionType: tipo de decisão (ACCEPTED, RECONCILED)
   * - isActive: ativo nos últimos 30 dias (true/false)
   *
   * Query Params - Participação:
   * - joinedAfter: entrou após data
   * - joinedBefore: entrou antes data
   *
   * Query Params - Ordenação e Paginação:
   * - sortBy: name, age, engagementScore, totalPagelas, presenceRate
   * - sortOrder: ASC, DESC
   * - page: página (default: 1)
   * - limit: itens por página (default: 20, max: 100)
   *
   * Retorna:
   * - Lista de crianças com todas as estatísticas
   * - Distribuições (gênero, idade, clube, cidade, tempo)
   * - Resumo e métricas gerais
   * - Paginação completa
   *
   * Exemplos:
   * - ?gender=F&city=São Paulo&minAge=6&maxAge=12
   * - ?clubId=uuid&hasDecision=true&sortBy=engagementScore&sortOrder=DESC
   * - ?isActive=true&minPresenceRate=80&page=1&limit=50
   * - ?city=Campinas&year=2024&minEngagementScore=70
   */
  @Get('children')
  async getChildrenStats(@Query() filters: ChildrenStatsQueryDto) {
    const started = Date.now();
    this.logger.log(
      `GET /statistics/children filters=${JSON.stringify(filters)}`,
    );
    try {
      const result = await this.statisticsService.getChildrenStats(filters);
      const r: any = result as any;
      const count = Array.isArray(r?.items)
        ? r.items.length
        : Array.isArray(r?.data)
          ? r.data.length
          : Array.isArray(r)
            ? r.length
            : (r?.total ?? r?.count ?? 'n/a');
      this.logger.log(
        `GET /statistics/children -> success in ${Date.now() - started}ms count=${count}`,
      );
      return result;
    } catch (err: any) {
      this.logger.error(
        `GET /statistics/children -> error in ${Date.now() - started}ms: ${err?.message}`,
      );
      throw err;
    }
  }

  /**
   * ENDPOINT: GET /statistics/clubs ⭐ NOVO - ✅ FUNCIONAL
   *
   * Lista de clubes com estatísticas detalhadas e filtros avançados
   *
   * Query Params - Filtros de Coordenador:
   * - coordinatorId: clubes de um coordenador específico
   *
   * Query Params - Filtros Geográficos:
   * - city: cidade
   * - state: estado
   * - district: bairro
   *
   * Query Params - Filtros de Atividade:
   * - weekday: dia da semana (MONDAY, TUESDAY, etc)
   * - year: ano das pagelas
   * - startDate, endDate: período das pagelas
   * - minChildren: mínimo de crianças
   * - minPresenceRate: taxa mínima de presença
   * - minPerformanceScore: score mínimo
   *
   * Query Params - Ordenação e Paginação:
   * - sortBy: number, performanceScore, totalChildren, presenceRate
   * - sortOrder: ASC, DESC
   * - page, limit
   *
   * Retorna:
   * - Lista de clubes com estatísticas completas
   * - Distribuições (cidade, dia da semana, coordenador, performance)
   * - Resumo geral
   * - Paginação
   *
   * Exemplos:
   * - ?coordinatorId=uuid (todos os clubes do coordenador)
   * - ?city=São Paulo&sortBy=performanceScore&sortOrder=DESC
   * - ?weekday=MONDAY&minPresenceRate=80
   */
  @Get('clubs')
  async getClubsStats(@Query() filters: ClubsStatsQueryDto) {
    const started = Date.now();
    this.logger.log(`GET /statistics/clubs filters=${JSON.stringify(filters)}`);
    try {
      const result = await this.statisticsService.getClubsStats(filters);
      const r: any = result as any;
      const count = Array.isArray(r?.items)
        ? r.items.length
        : Array.isArray(r?.data)
          ? r.data.length
          : Array.isArray(r)
            ? r.length
            : (r?.total ?? r?.count ?? 'n/a');
      this.logger.log(
        `GET /statistics/clubs -> success in ${Date.now() - started}ms count=${count}`,
      );
      return result;
    } catch (err: any) {
      this.logger.error(
        `GET /statistics/clubs -> error in ${Date.now() - started}ms: ${err?.message}`,
      );
      throw err;
    }
  }

  /**
   * ENDPOINT: GET /statistics/teachers ⭐ NOVO - ✅ FUNCIONAL
   *
   * Lista de professores com estatísticas detalhadas
   *
   * Query Params - Filtros de Entidade:
   * - clubId: professores de um clube
   * - coordinatorId: professores dos clubes de um coordenador
   *
   * Query Params - Filtros Geográficos:
   * - city: cidade
   * - state: estado
   *
   * Query Params - Filtros de Atividade:
   * - year: ano das pagelas
   * - startDate, endDate: período
   * - minPagelas: mínimo de pagelas
   * - minChildren: mínimo de crianças
   * - minPresenceRate: taxa mínima
   * - minEffectivenessScore: score mínimo
   * - isActive: ativo últimos 30 dias
   *
   * Query Params - Ordenação e Paginação:
   * - sortBy: name, effectivenessScore, totalPagelas, presenceRate
   * - sortOrder: ASC, DESC
   * - page, limit
   *
   * Retorna:
   * - Lista de professores com métricas
   * - Distribuições (clube, cidade, efetividade)
   * - Resumo geral
   * - Paginação
   *
   * Exemplos:
   * - ?clubId=uuid (professores do clube)
   * - ?coordinatorId=uuid&sortBy=effectivenessScore&sortOrder=DESC
   * - ?isActive=true&minEffectivenessScore=80
   */
  @Get('teachers')
  async getTeachersStats(@Query() filters: TeachersStatsQueryDto) {
    const started = Date.now();
    this.logger.log(
      `GET /statistics/teachers filters=${JSON.stringify(filters)}`,
    );
    try {
      const result = await this.statisticsService.getTeachersStats(filters);
      const r: any = result as any;
      const count = Array.isArray(r?.items)
        ? r.items.length
        : Array.isArray(r?.data)
          ? r.data.length
          : Array.isArray(r)
            ? r.length
            : (r?.total ?? r?.count ?? 'n/a');
      this.logger.log(
        `GET /statistics/teachers -> success in ${Date.now() - started}ms count=${count}`,
      );
      return result;
    } catch (err: any) {
      this.logger.error(
        `GET /statistics/teachers -> error in ${Date.now() - started}ms: ${err?.message}`,
      );
      throw err;
    }
  }

  /**
   * ENDPOINT: GET /statistics/clubs/:clubId
   *
   * Visão completa de um clubinho específico
   *
   * Retorna:
   * - Informações detalhadas do clube
   * - Estatísticas de crianças (gênero, idade, top engajadas)
   * - Performance (semana, mês, tendências)
   * - Timeline de atividades
   * - Lista de professores e suas métricas
   *
   * Filtros opcionais via query params:
   * - startDate, endDate: período da análise
   * - groupBy: agrupamento da timeline
   *
   * Exemplo: /statistics/clubs/uuid-do-clube?startDate=2024-01-01&groupBy=week
   */
  @Get('clubs/:clubId')
  async getClubDetailedStats(
    @Param('clubId') clubId: string,
    @Query() filters: PagelasStatsQueryDto,
  ) {
    const started = Date.now();
    this.logger.log(
      `GET /statistics/clubs/${clubId} filters=${JSON.stringify(filters)}`,
    );
    try {
      const result = await this.statisticsService.getClubDetailedStats(
        clubId,
        filters,
      );
      this.logger.log(
        `GET /statistics/clubs/${clubId} -> success in ${Date.now() - started}ms`,
      );
      return result;
    } catch (err: any) {
      this.logger.error(
        `GET /statistics/clubs/${clubId} -> error in ${Date.now() - started}ms: ${err?.message}`,
      );
      throw err;
    }
  }

  /**
   * ENDPOINT: GET /statistics/children/:childId
   *
   * Visão completa do histórico de uma criança
   *
   * Retorna:
   * - Informações pessoais e demográficas
   * - Resumo de estatísticas e engajamento
   * - Histórico de decisões
   * - Padrão de frequência
   * - Progresso ao longo do tempo
   * - Timeline detalhada de todas as pagelas
   *
   * Ideal para:
   * - Acompanhamento individual
   * - Relatórios para pais/responsáveis
   * - Identificar necessidades específicas
   *
   * Exemplo: /statistics/children/uuid-da-crianca
   */
  @Get('children/:childId')
  async getChildDetailedStats(@Param('childId') childId: string) {
    const started = Date.now();
    this.logger.log(`GET /statistics/children/${childId}`);
    try {
      const result =
        await this.statisticsService.getChildDetailedStats(childId);
      this.logger.log(
        `GET /statistics/children/${childId} -> success in ${Date.now() - started}ms`,
      );
      return result;
    } catch (err: any) {
      this.logger.error(
        `GET /statistics/children/${childId} -> error in ${Date.now() - started}ms: ${err?.message}`,
      );
      throw err;
    }
  }

  /**
   * ENDPOINT: GET /statistics/cities/:city
   *
   * Visão completa de uma cidade
   *
   * Retorna:
   * - Informações gerais da cidade
   * - Resumo de todos os clubes na cidade
   * - Demografia das crianças
   * - Performance comparada ao estado
   * - Timeline mensal
   * - Análise por bairros
   *
   * Query params opcionais:
   * - state: especificar estado (necessário se cidade não única)
   * - startDate, endDate: período
   *
   * Ideal para:
   * - Planejamento de expansão
   * - Análise regional
   * - Relatórios municipais
   *
   * Exemplo: /statistics/cities/São Paulo?state=SP&startDate=2024-01-01
   */
  @Get('cities/:city')
  async getCityDetailedStats(
    @Param('city') city: string,
    @Query() filters: any,
  ) {
    const started = Date.now();
    this.logger.log(
      `GET /statistics/cities/${city} filters=${JSON.stringify(filters)}`,
    );
    try {
      const result = await this.statisticsService.getCityDetailedStats(
        city,
        filters,
      );
      this.logger.log(
        `GET /statistics/cities/${city} -> success in ${Date.now() - started}ms`,
      );
      return result;
    } catch (err: any) {
      this.logger.error(
        `GET /statistics/cities/${city} -> error in ${Date.now() - started}ms: ${err?.message}`,
      );
      throw err;
    }
  }

  /**
   * ENDPOINT: GET /statistics/teachers/:teacherId
   *
   * Visão completa de um professor
   *
   * Retorna:
   * - Informações do professor e clube
   * - Resumo de métricas e efetividade
   * - Lista de crianças que ele ensina
   * - Performance ao longo do tempo
   * - Timeline de atividades
   * - Comparação com outros professores
   *
   * Ideal para:
   * - Avaliação de desempenho
   * - Feedback individual
   * - Reconhecimento de destaque
   *
   * Exemplo: /statistics/teachers/uuid-do-professor?startDate=2024-01-01
   */
  @Get('teachers/:teacherId')
  async getTeacherDetailedStats(
    @Param('teacherId') teacherId: string,
    @Query() filters: PagelasStatsQueryDto,
  ) {
    const started = Date.now();
    this.logger.log(
      `GET /statistics/teachers/${teacherId} filters=${JSON.stringify(filters)}`,
    );
    try {
      const result = await this.statisticsService.getTeacherDetailedStats(
        teacherId,
        filters,
      );
      this.logger.log(
        `GET /statistics/teachers/${teacherId} -> success in ${Date.now() - started}ms`,
      );
      return result;
    } catch (err: any) {
      this.logger.error(
        `GET /statistics/teachers/${teacherId} -> error in ${Date.now() - started}ms: ${err?.message}`,
      );
      throw err;
    }
  }

  /**
   * ENDPOINT: GET /statistics/compare
   *
   * Comparação entre múltiplas entidades
   *
   * Query params:
   * - type: 'clubs' | 'cities' | 'teachers'
   * - ids: lista separada por vírgula (id1,id2,id3)
   * - metric: métrica principal para comparação
   * - startDate, endDate: período
   *
   * Retorna:
   * - Métricas comparativas
   * - Rankings
   * - Gráfico de comparação
   *
   * Ideal para:
   * - Benchmarking
   * - Identificar melhores práticas
   * - Competições amigáveis
   *
   * Exemplo: /statistics/compare?type=clubs&ids=uuid1,uuid2,uuid3&metric=presenceRate
   */
  @Get('compare')
  async getComparativeStats(@Query() params: any) {
    const started = Date.now();
    this.logger.log(`GET /statistics/compare params=${JSON.stringify(params)}`);
    try {
      const result = await this.statisticsService.getComparativeStats(params);
      this.logger.log(
        `GET /statistics/compare -> success in ${Date.now() - started}ms`,
      );
      return result;
    } catch (err: any) {
      this.logger.error(
        `GET /statistics/compare -> error in ${Date.now() - started}ms: ${err?.message}`,
      );
      throw err;
    }
  }

  /**
   * ENDPOINT: GET /statistics/trends
   *
   * Análise de tendências e previsões
   *
   * Query params opcionais:
   * - startDate, endDate: período de análise
   * - metric: métrica específica (presence, meditation, decisions)
   * - clubId, cityId: filtrar por entidade
   *
   * Retorna:
   * - Tendências gerais
   * - Padrões identificados
   * - Previsões para próximo período
   * - Anomalias detectadas
   *
   * Ideal para:
   * - Planejamento estratégico
   * - Identificar problemas antecipadamente
   * - Otimização de recursos
   *
   * Exemplo: /statistics/trends?startDate=2024-01-01&metric=presence
   */
  @Get('trends')
  async getTrendsAnalysis(@Query() filters: any) {
    const started = Date.now();
    this.logger.log(
      `GET /statistics/trends filters=${JSON.stringify(filters)}`,
    );
    try {
      const result = await this.statisticsService.getTrendsAnalysis(filters);
      this.logger.log(
        `GET /statistics/trends -> success in ${Date.now() - started}ms`,
      );
      return result;
    } catch (err: any) {
      this.logger.error(
        `GET /statistics/trends -> error in ${Date.now() - started}ms: ${err?.message}`,
      );
      throw err;
    }
  }

  /**
   * ENDPOINT: GET /statistics/reports/consolidated
   *
   * Relatório consolidado completo
   *
   * Query params:
   * - startDate, endDate: período do relatório (obrigatório)
   * - includeClubs: incluir análise de clubes (default: true)
   * - includeCities: incluir análise de cidades (default: true)
   * - includeTeachers: incluir análise de professores (default: true)
   * - includeChildren: incluir análise de crianças (default: false)
   * - format: 'json' | 'summary' (default: 'json')
   *
   * Retorna:
   * - Resumo executivo
   * - Análise por todas as dimensões
   * - Destaques e conquistas
   * - Recomendações baseadas em dados
   *
   * Ideal para:
   * - Relatórios mensais/anuais
   * - Apresentações para liderança
   * - Documentação de impacto
   *
   * Exemplo: /statistics/reports/consolidated?startDate=2024-01-01&endDate=2024-12-31
   */
  @Get('reports/consolidated')
  async getConsolidatedReport(@Query() params: any) {
    const started = Date.now();
    this.logger.log(
      `GET /statistics/reports/consolidated params=${JSON.stringify(params)}`,
    );
    try {
      const result = await this.statisticsService.getConsolidatedReport(params);
      this.logger.log(
        `GET /statistics/reports/consolidated -> success in ${Date.now() - started}ms`,
      );
      return result;
    } catch (err: any) {
      this.logger.error(
        `GET /statistics/reports/consolidated -> error in ${Date.now() - started}ms: ${err?.message}`,
      );
      throw err;
    }
  }

  /**
   * ENDPOINT: GET /statistics/rankings/:type
   *
   * Rankings por tipo
   *
   * Params:
   * - type: 'clubs' | 'children' | 'teachers' | 'cities'
   *
   * Query params:
   * - metric: métrica para ranking (presenceRate, engagementScore, etc)
   * - limit: número de resultados (default: 10)
   * - startDate, endDate: período
   *
   * Retorna ranking ordenado com scores
   *
   * Exemplo: /statistics/rankings/clubs?metric=performanceScore&limit=5
   */
  @Get('rankings/:type')
  async getRankings(@Param('type') type: string, @Query() params: any) {
    const started = Date.now();
    this.logger.log(
      `GET /statistics/rankings/${type} params=${JSON.stringify(params)}`,
    );
    try {
      const result = await this.statisticsService.getRankings(type, params);
      this.logger.log(
        `GET /statistics/rankings/${type} -> success in ${Date.now() - started}ms`,
      );
      return result;
    } catch (err: any) {
      this.logger.error(
        `GET /statistics/rankings/${type} -> error in ${Date.now() - started}ms: ${err?.message}`,
      );
      throw err;
    }
  }

  /**
   * ENDPOINT: GET /statistics/dashboard/:role
   *
   * Dashboard personalizado por tipo de usuário
   *
   * Params:
   * - role: 'coordinator' | 'teacher' | 'admin'
   *
   * Query params:
   * - userId: ID do usuário (para personalização)
   *
   * Retorna dashboard otimizado para o papel do usuário:
   * - Coordinator: visão dos seus clubes
   * - Teacher: visão das suas turmas
   * - Admin: visão geral do sistema
   *
   * Exemplo: /statistics/dashboard/coordinator?userId=uuid-coordenador
   */
  @Get('dashboard/:role')
  async getPersonalizedDashboard(
    @Param('role') role: string,
    @Query('userId') userId: string,
  ) {
    const started = Date.now();
    this.logger.log(`GET /statistics/dashboard/${role}?userId=${userId}`);
    try {
      const result = await this.statisticsService.getPersonalizedDashboard(
        role,
        userId,
      );
      this.logger.log(
        `GET /statistics/dashboard/${role} -> success in ${Date.now() - started}ms`,
      );
      return result;
    } catch (err: any) {
      this.logger.error(
        `GET /statistics/dashboard/${role} -> error in ${Date.now() - started}ms: ${err?.message}`,
      );
      throw err;
    }
  }

  // ============= ATTENDANCE ANALYSIS ENDPOINTS =============

  /**
   * ENDPOINT: GET /statistics/attendance/club/:clubId ⭐ NOVO - ✅ FUNCIONAL
   *
   * Análise de frequência semanal de um clube
   * DETECTA SEMANAS FALTANTES automaticamente
   *
   * Query Params:
   * - year: ano para análise (obrigatório)
   * - startDate: data inicial (opcional, default: 01/01/year)
   * - endDate: data final (opcional, default: 31/12/year)
   *
   * Retorna:
   * - Período de análise
   * - Métricas de frequência (semanas com/sem pagela)
   * - Lista de semanas faltantes
   * - ALERTAS (crítico, aviso, info)
   * - Timeline completa semana a semana
   *
   * Alertas Gerados:
   * - ⚠️ WARNING: Clubinho tem X semanas sem pagela
   * - 🔴 CRITICAL: Taxa de frequência < 50%
   * - 🔴 CRITICAL: 3+ semanas consecutivas sem pagela
   *
   * Ideal para:
   * - Coordenadores monitorarem seus clubes
   * - Identificar clubes com problemas
   * - Planejar ações corretivas
   * - Acompanhamento semanal
   *
   * Exemplo: /statistics/attendance/club/uuid?year=2024
   */
  @Get('attendance/club/:clubId')
  async analyzeClubAttendance(
    @Param('clubId') clubId: string,
    @Query('year') year: number,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ) {
    const started = Date.now();
    this.logger.log(
      `GET /statistics/attendance/club/${clubId}?year=${year}&page=${page ?? 1}&limit=${limit ?? 50}`,
    );
    try {
      const result = await this.statisticsService.analyzeClubAttendance(
        clubId,
        Number(year),
        startDate,
        endDate,
        page ? Number(page) : undefined,
        limit ? Number(limit) : undefined,
      );
      this.logger.log(
        `GET /statistics/attendance/club/${clubId} -> success in ${Date.now() - started}ms timeline=${result?.timeline?.length ?? 0} missingWeeks=${result?.missingWeeks?.length ?? 0}`,
      );
      return result;
    } catch (err: any) {
      this.logger.error(
        `GET /statistics/attendance/club/${clubId} -> error in ${Date.now() - started}ms: ${err?.message}`,
      );
      throw err;
    }
  }

  /**
   * ENDPOINT: GET /statistics/attendance/week ⭐ NOVO - ✅ FUNCIONAL
   *
   * Análise de todos os clubes em uma semana específica
   * Mostra quais clubes tiveram pagela e quais faltaram
   *
   * ⚠️ IMPORTANTE: year e week são do ANO LETIVO, não semana ISO!
   * - year: Ano do período letivo (ex: 2024)
   * - week: Semana do ano letivo (semana 1 = primeira semana dentro do período letivo)
   *
   * As pagelas são armazenadas com semana do ano letivo. Use o endpoint
   * /club-control/current-week para obter a semana atual do ano letivo.
   *
   * Query Params:
   * - year: ano do período letivo (obrigatório)
   * - week: semana do ano letivo (obrigatório, 1-53)
   *
   * Retorna:
   * - Período da semana
   * - Lista de todos os clubes
   * - Status de cada clube (ok, missing, vacation)
   * - Data esperada da pagela (baseado no dia da semana)
   * - Resumo (quantos ok, quantos faltando)
   *
   * Ideal para:
   * - Visão geral semanal
   * - Identificar clubes que faltaram
   * - Planejamento semanal
   * - Dashboard de coordenadores
   *
   * Exemplo: /statistics/attendance/week?year=2024&week=45
   */
  @Get('attendance/week')
  async analyzeWeeklyAttendance(
    @Query('year') year: number,
    @Query('week') week: number,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ) {
    const started = Date.now();
    this.logger.log(
      `GET /statistics/attendance/week?year=${year}&week=${week}&page=${page ?? 1}&limit=${limit ?? 50}`,
    );
    try {
      const result = await this.statisticsService.analyzeWeeklyAttendance(
        Number(year),
        Number(week),
        page ? Number(page) : undefined,
        limit ? Number(limit) : undefined,
      );
      this.logger.log(
        `GET /statistics/attendance/week -> success in ${Date.now() - started}ms clubs=${result?.clubs?.length ?? 0} total=${result?.pagination?.total ?? 0}`,
      );
      return result;
    } catch (err: any) {
      this.logger.error(
        `GET /statistics/attendance/week -> error in ${Date.now() - started}ms: ${err?.message}`,
      );
      throw err;
    }
  }
}
