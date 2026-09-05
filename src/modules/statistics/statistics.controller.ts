import {
  Controller,
  Get,
  Query,
  Param,
  Logger,
  UseGuards,
  ParseUUIDPipe,
} from '@nestjs/common';
import { JwtAuthGuard } from 'src/core/auth/guards/jwt-auth.guard';
import { AdminRoleGuard } from 'src/core/auth/guards/role-guard';
import { StatisticsService } from './statistics.service';
import { PagelasStatsQueryDto } from './dto/pagelas-stats-query.dto';
import { AcceptedChristsStatsQueryDto } from './dto/accepted-christs-stats-query.dto';
import { ChildrenStatsQueryDto } from './dto/children-stats-query.dto';
import { ClubsStatsQueryDto } from './dto/clubs-stats-query.dto';
import { TeachersStatsQueryDto } from './dto/teachers-stats-query.dto';
import {
  ClubAttendanceQueryDto,
  WeeklyAttendanceQueryDto,
} from './dto/attendance-query.dto';
import {
  ClubAttendanceAnalysisDto,
  WeeklyAttendanceDto,
} from './dto/club-attendance-analysis.dto';
import {
  AcceptedChristsChartDataDto,
  CombinedInsightsDto,
  PagelasChartDataDto,
} from './dto/chart-data-response.dto';
import { OverviewStatsResponseDto } from './dto/overview-stats-response.dto';
import { PagelasStatsResponseDto } from './dto/pagelas-stats-response.dto';
import { AcceptedChristsStatsResponseDto } from './dto/accepted-christs-stats-response.dto';
import { ChildrenStatsResponseDto } from './dto/children-stats-response.dto';
import { ClubsStatsResponseDto } from './dto/clubs-stats-response.dto';
import { TeachersStatsResponseDto } from './dto/teachers-stats-response.dto';

@Controller('statistics')
@UseGuards(JwtAuthGuard, AdminRoleGuard)
export class StatisticsController {
  private readonly logger = new Logger(StatisticsController.name);

  constructor(private readonly statisticsService: StatisticsService) {}

  @Get('pagelas/charts')
  async getPagelasChartData(
    @Query() filters: PagelasStatsQueryDto,
  ): Promise<PagelasChartDataDto> {
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
  ): Promise<AcceptedChristsChartDataDto> {
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
  async getCombinedInsights(
    @Query() filters: PagelasStatsQueryDto,
  ): Promise<CombinedInsightsDto> {
    const started = Date.now();
    this.logger.log(
      `GET /statistics/insights filters=${JSON.stringify(filters)}`,
    );

    try {
      const result = await this.statisticsService.getCombinedInsights(filters);
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
  async getOverviewStatistics(): Promise<OverviewStatsResponseDto> {
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
  async getPagelasStatistics(
    @Query() filters: PagelasStatsQueryDto,
  ): Promise<PagelasStatsResponseDto> {
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
  ): Promise<AcceptedChristsStatsResponseDto> {
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
  async getChildrenStats(
    @Query() filters: ChildrenStatsQueryDto,
  ): Promise<ChildrenStatsResponseDto> {
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
  async getClubsStats(
    @Query() filters: ClubsStatsQueryDto,
  ): Promise<ClubsStatsResponseDto> {
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
  async getTeachersStats(
    @Query() filters: TeachersStatsQueryDto,
  ): Promise<TeachersStatsResponseDto> {
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

  @Get('attendance/club/:clubId')
  async analyzeClubAttendance(
    @Param('clubId', ParseUUIDPipe) clubId: string,
    @Query() query: ClubAttendanceQueryDto,
  ): Promise<ClubAttendanceAnalysisDto> {
    const { year, startDate, endDate, page, limit } = query;
    const started = Date.now();
    this.logger.log(
      `GET /statistics/attendance/club/${clubId}?year=${year}&page=${page ?? 1}&limit=${limit ?? 50}`,
    );
    try {
      const result = await this.statisticsService.analyzeClubAttendance(
        clubId,
        year,
        startDate,
        endDate,
        page,
        limit,
      );
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
    @Query() query: WeeklyAttendanceQueryDto,
  ): Promise<WeeklyAttendanceDto> {
    const { year, week, page, limit } = query;
    const started = Date.now();
    this.logger.log(
      `GET /statistics/attendance/week?year=${year}&week=${week}&page=${page ?? 1}&limit=${limit ?? 50}`,
    );
    try {
      const result = await this.statisticsService.analyzeWeeklyAttendance(
        year,
        week,
        page,
        limit,
      );
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
