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
    } catch (err: any) {
      this.logger.error(
        `GET /statistics/pagelas/charts -> error in ${Date.now() - started}ms: ${err?.message}`,
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
    } catch (err: any) {
      this.logger.error(
        `GET /statistics/accepted-christs/charts -> error in ${Date.now() - started}ms: ${err?.message}`,
      );
      throw err;
    }
  }

  @Get('insights')
  async getCombinedInsights(@Query() allFilters: any) {
    const started = Date.now();
    this.logger.log(
      `GET /statistics/insights filters=${JSON.stringify(allFilters)}`,
    );

    const pagelasFilters: PagelasStatsQueryDto = {};
    const acFilters: AcceptedChristsStatsQueryDto = {};

    Object.keys(allFilters).forEach((key) => {
      if (key.startsWith('pagelas_')) {
        const cleanKey = key.replace('pagelas_', '');
        pagelasFilters[cleanKey] = allFilters[key];
      } else if (key.startsWith('ac_')) {
        const cleanKey = key.replace('ac_', '');
        acFilters[cleanKey] = allFilters[key];
      } else {
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
