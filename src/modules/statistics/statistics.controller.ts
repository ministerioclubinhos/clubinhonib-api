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
      const errorMessage = err instanceof Error ? err.message : String(err);
      this.logger.error(
        `GET /statistics/pagelas/charts -> error in ${Date.now() - started}ms: ${errorMessage}`,
      );
      throw err;
    }
  }

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
      const errorMessage = err instanceof Error ? err.message : String(err);
      this.logger.error(
        `GET /statistics/accepted-christs/charts -> error in ${Date.now() - started}ms: ${errorMessage}`,
      );
      throw err;
    }
  }

  @Get('insights')
  async getCombinedInsights(@Query() allFilters: Record<string, any>) {
    const started = Date.now();
    this.logger.log(
      `GET /statistics/insights filters=${JSON.stringify(allFilters)}`,
    );

    const pagelasFilters: Record<string, unknown> = {};
    const acFilters: Record<string, unknown> = {};

    Object.keys(allFilters).forEach((key) => {
      if (key.startsWith('pagelas_')) {
        const cleanKey = key.replace('pagelas_', '');
        pagelasFilters[cleanKey] = allFilters[key] as unknown;
      } else if (key.startsWith('ac_')) {
        const cleanKey = key.replace('ac_', '');
        acFilters[cleanKey] = allFilters[key] as unknown;
      } else {
        pagelasFilters[key] = allFilters[key] as unknown;
        acFilters[key] = allFilters[key] as unknown;
      }
    });

    try {
      const result = await this.statisticsService.getCombinedInsights(
        pagelasFilters as unknown as PagelasStatsQueryDto,
      );
      this.logger.log(
        `GET /statistics/insights -> success in ${Date.now() - started}ms`,
      );
      return result;
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      this.logger.error(
        `GET /statistics/insights -> error in ${Date.now() - started}ms: ${errorMessage}`,
      );
      throw err;
    }
  }

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
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      this.logger.error(
        `GET /statistics/overview -> error in ${Date.now() - started}ms: ${errorMessage}`,
      );
      throw err;
    }
  }

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
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      this.logger.error(
        `GET /statistics/pagelas -> error in ${Date.now() - started}ms: ${errorMessage}`,
      );
      throw err;
    }
  }

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
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      this.logger.error(
        `GET /statistics/accepted-christs -> error in ${Date.now() - started}ms: ${errorMessage}`,
      );
      throw err;
    }
  }

  @Get('children')
  async getChildrenStats(@Query() filters: ChildrenStatsQueryDto) {
    const started = Date.now();
    this.logger.log(
      `GET /statistics/children filters=${JSON.stringify(filters)}`,
    );
    try {
      const result = await this.statisticsService.getChildrenStats(filters);
      const count = result.children ? result.children.length : 0;
      this.logger.log(
        `GET /statistics/children -> success in ${Date.now() - started}ms count=${count}`,
      );
      return result;
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      this.logger.error(
        `GET /statistics/children -> error in ${Date.now() - started}ms: ${errorMessage}`,
      );
      throw err;
    }
  }

  @Get('clubs')
  async getClubsStats(@Query() filters: ClubsStatsQueryDto) {
    const started = Date.now();
    this.logger.log(`GET /statistics/clubs filters=${JSON.stringify(filters)}`);
    try {
      const result = await this.statisticsService.getClubsStats(filters);
      const count = result.clubs ? result.clubs.length : 0;
      this.logger.log(
        `GET /statistics/clubs -> success in ${Date.now() - started}ms count=${count}`,
      );
      return result;
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      this.logger.error(
        `GET /statistics/clubs -> error in ${Date.now() - started}ms: ${errorMessage}`,
      );
      throw err;
    }
  }

  @Get('teachers')
  async getTeachersStats(@Query() filters: TeachersStatsQueryDto) {
    const started = Date.now();
    this.logger.log(
      `GET /statistics/teachers filters=${JSON.stringify(filters)}`,
    );
    try {
      const result = await this.statisticsService.getTeachersStats(filters);
      const count = result.teachers ? result.teachers.length : 0;
      this.logger.log(
        `GET /statistics/teachers -> success in ${Date.now() - started}ms count=${count}`,
      );
      return result;
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      this.logger.error(
        `GET /statistics/teachers -> error in ${Date.now() - started}ms: ${errorMessage}`,
      );
      throw err;
    }
  }

  @Get('clubs/:clubId')
  getClubDetailedStats(
    @Param('clubId') clubId: string,
    @Query() filters: PagelasStatsQueryDto,
  ) {
    const started = Date.now();
    this.logger.log(
      `GET /statistics/clubs/${clubId} filters=${JSON.stringify(filters)}`,
    );
    try {
      const result = this.statisticsService.getClubDetailedStats(
        clubId,
        filters,
      );
      this.logger.log(
        `GET /statistics/clubs/${clubId} -> success in ${Date.now() - started}ms`,
      );
      return result;
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      this.logger.error(
        `GET /statistics/clubs/${clubId} -> error in ${Date.now() - started}ms: ${errorMessage}`,
      );
      throw err;
    }
  }

  @Get('children/:childId')
  getChildDetailedStats(@Param('childId') childId: string) {
    const started = Date.now();
    this.logger.log(`GET /statistics/children/${childId}`);
    try {
      const result = this.statisticsService.getChildDetailedStats(childId);
      this.logger.log(
        `GET /statistics/children/${childId} -> success in ${Date.now() - started}ms`,
      );
      return result;
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      this.logger.error(
        `GET /statistics/children/${childId} -> error in ${Date.now() - started}ms: ${errorMessage}`,
      );
      throw err;
    }
  }

  @Get('cities/:city')
  getCityDetailedStats(
    @Param('city') city: string,
    @Query() filters: Record<string, any>,
  ) {
    const started = Date.now();
    this.logger.log(
      `GET /statistics/cities/${city} filters=${JSON.stringify(filters)}`,
    );
    try {
      const result = this.statisticsService.getCityDetailedStats(
        city,
        filters as PagelasStatsQueryDto,
      );
      this.logger.log(
        `GET /statistics/cities/${city} -> success in ${Date.now() - started}ms`,
      );
      return result;
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      this.logger.error(
        `GET /statistics/cities/${city} -> error in ${Date.now() - started}ms: ${errorMessage}`,
      );
      throw err;
    }
  }

  @Get('teachers/:teacherId')
  getTeacherDetailedStats(
    @Param('teacherId') teacherId: string,
    @Query() filters: PagelasStatsQueryDto,
  ) {
    const started = Date.now();
    this.logger.log(
      `GET /statistics/teachers/${teacherId} filters=${JSON.stringify(filters)}`,
    );
    try {
      const result = this.statisticsService.getTeacherDetailedStats(
        teacherId,
        filters,
      );
      this.logger.log(
        `GET /statistics/teachers/${teacherId} -> success in ${Date.now() - started}ms`,
      );
      return result;
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      this.logger.error(
        `GET /statistics/teachers/${teacherId} -> error in ${Date.now() - started}ms: ${errorMessage}`,
      );
      throw err;
    }
  }

  @Get('compare')
  getComparativeStats(@Query() params: Record<string, any>) {
    const started = Date.now();
    this.logger.log(`GET /statistics/compare params=${JSON.stringify(params)}`);
    try {
      const result = this.statisticsService.getComparativeStats(params);
      this.logger.log(
        `GET /statistics/compare -> success in ${Date.now() - started}ms`,
      );
      return result;
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      this.logger.error(
        `GET /statistics/compare -> error in ${Date.now() - started}ms: ${errorMessage}`,
      );
      throw err;
    }
  }

  @Get('trends')
  getTrendsAnalysis(@Query() filters: Record<string, any>) {
    const started = Date.now();
    this.logger.log(
      `GET /statistics/trends filters=${JSON.stringify(filters)}`,
    );
    try {
      const result = this.statisticsService.getTrendsAnalysis(filters);
      this.logger.log(
        `GET /statistics/trends -> success in ${Date.now() - started}ms`,
      );
      return result;
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      this.logger.error(
        `GET /statistics/trends -> error in ${Date.now() - started}ms: ${errorMessage}`,
      );
      throw err;
    }
  }

  @Get('reports/consolidated')
  getConsolidatedReport(@Query() params: Record<string, any>) {
    const started = Date.now();
    this.logger.log(
      `GET /statistics/reports/consolidated params=${JSON.stringify(params)}`,
    );
    try {
      const result = this.statisticsService.getConsolidatedReport(params);
      this.logger.log(
        `GET /statistics/reports/consolidated -> success in ${Date.now() - started}ms`,
      );
      return result;
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      this.logger.error(
        `GET /statistics/reports/consolidated -> error in ${Date.now() - started}ms: ${errorMessage}`,
      );
      throw err;
    }
  }

  @Get('rankings/:type')
  getRankings(
    @Param('type') type: string,
    @Query() params: Record<string, any>,
  ) {
    const started = Date.now();
    this.logger.log(
      `GET /statistics/rankings/${type} params=${JSON.stringify(params)}`,
    );
    try {
      const result = this.statisticsService.getRankings(type, params);
      this.logger.log(
        `GET /statistics/rankings/${type} -> success in ${Date.now() - started}ms`,
      );
      return result;
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      this.logger.error(
        `GET /statistics/rankings/${type} -> error in ${Date.now() - started}ms: ${errorMessage}`,
      );
      throw err;
    }
  }

  @Get('dashboard/:role')
  getPersonalizedDashboard(
    @Param('role') role: string,
    @Query('userId') userId: string,
  ) {
    const started = Date.now();
    this.logger.log(`GET /statistics/dashboard/${role}?userId=${userId}`);
    try {
      const result = this.statisticsService.getPersonalizedDashboard(
        role,
        userId,
      );
      this.logger.log(
        `GET /statistics/dashboard/${role} -> success in ${Date.now() - started}ms`,
      );
      return result;
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      this.logger.error(
        `GET /statistics/dashboard/${role} -> error in ${Date.now() - started}ms: ${errorMessage}`,
      );
      throw err;
    }
  }

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
      const result = (await this.statisticsService.analyzeClubAttendance(
        clubId,
        Number(year),
        startDate,
        endDate,
        page ? Number(page) : undefined,
        limit ? Number(limit) : undefined,
      )) as { timeline?: any[]; missingWeeks?: any[] };
      this.logger.log(
        `GET /statistics/attendance/club/${clubId} -> success in ${Date.now() - started}ms timeline=${result.timeline?.length ?? 0} missingWeeks=${result.missingWeeks?.length ?? 0}`,
      );
      return result;
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      this.logger.error(
        `GET /statistics/attendance/club/${clubId} -> error in ${Date.now() - started}ms: ${errorMessage}`,
      );
      throw err;
    }
  }

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
      const result = (await this.statisticsService.analyzeWeeklyAttendance(
        Number(year),
        Number(week),
        page ? Number(page) : undefined,
        limit ? Number(limit) : undefined,
      )) as { clubs?: any[]; pagination?: { total?: number } };
      this.logger.log(
        `GET /statistics/attendance/week -> success in ${Date.now() - started}ms clubs=${result.clubs?.length ?? 0} total=${result.pagination?.total ?? 0}`,
      );
      return result;
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      this.logger.error(
        `GET /statistics/attendance/week -> error in ${Date.now() - started}ms: ${errorMessage}`,
      );
      throw err;
    }
  }
}
