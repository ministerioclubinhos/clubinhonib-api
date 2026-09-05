import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  Delete,
  Put,
  Logger,
  UseGuards,
  Patch,
  ParseUUIDPipe,
} from '@nestjs/common';
import { JwtAuthGuard } from 'src/core/auth/guards/jwt-auth.guard';
import { AdminRoleGuard } from 'src/core/auth/guards/role-guard';
import { AppNotFoundException, ErrorCode } from 'src/shared/exceptions';
import { ClubControlService } from '../services/club-control.service';
import { CreateClubPeriodDto } from '../dto/create-club-period.dto';
import { UpdateClubPeriodDto } from '../dto/update-club-period.dto';
import { CreateClubExceptionDto } from '../dto/create-club-exception.dto';
import { UpdateClubExceptionDto } from '../dto/update-club-exception.dto';
import {
  DetailedIndicatorsQueryDto,
  DateParamDto,
  ExceptionsQueryDto,
  PaginationQueryDto,
  RequiredWeekQueryDto,
  WeekQueryDto,
  YearParamDto,
} from '../dto/club-control-query.dto';
import {
  ClubControlDashboardResponseDto,
  ClubExceptionResponseDto,
  ClubPeriodResponseDto,
  ClubsWeekCheckResponseDto,
  CurrentAcademicWeekDto,
  DeleteResultDto,
  PaginatedClubExceptionsDto,
  PaginatedClubPeriodsDto,
} from '../dto/club-control-contracts.dto';
import { ClubCheckResultDto } from '../dto/club-check-result.dto';
import { DetailedIndicatorsResultDto } from '../dto/detailed-indicators-result.dto';

interface PaginatedResult {
  items?: unknown[];
}

interface WeekCheckResult {
  clubs?: unknown[];
  summary?: { totalClubs?: number };
  year?: number;
  week?: number;
}

interface DetailedFilters {
  status?: string;
  severity?: string;
  weekday?: string;
  indicatorType?: string;
  hasProblems?: boolean;
  page?: number;
  limit?: number;
}

const getErrorMessage = (err: unknown): string =>
  err instanceof Error ? err.message : String(err);

@Controller('club-control')
@UseGuards(JwtAuthGuard, AdminRoleGuard)
export class ClubControlController {
  private readonly logger = new Logger(ClubControlController.name);

  constructor(private readonly clubControlService: ClubControlService) {}

  @Post('periods')
  async createPeriod(
    @Body() dto: CreateClubPeriodDto,
  ): Promise<ClubPeriodResponseDto> {
    const started = Date.now();
    this.logger.log(`POST /club-control/periods year=${dto.year}`);
    try {
      const result = await this.clubControlService.createPeriod(dto);
      this.logger.log(
        `POST /club-control/periods -> success in ${Date.now() - started}ms id=${result?.id ?? 'n/a'}`,
      );
      return result;
    } catch (err: unknown) {
      this.logger.error(
        `POST /club-control/periods -> error in ${Date.now() - started}ms: ${getErrorMessage(err)}`,
      );
      throw err;
    }
  }

  @Get('periods/:year')
  async getPeriodByYear(
    @Param() params: YearParamDto,
  ): Promise<ClubPeriodResponseDto | null> {
    const { year } = params;
    const started = Date.now();
    this.logger.log(`GET /club-control/periods/${year}`);
    try {
      const result = await this.clubControlService.getPeriodByYear(year);
      this.logger.log(
        `GET /club-control/periods/${year} -> success in ${Date.now() - started}ms found=${!!result}`,
      );
      return result;
    } catch (err: unknown) {
      this.logger.error(
        `GET /club-control/periods/${year} -> error in ${Date.now() - started}ms: ${getErrorMessage(err)}`,
      );
      throw err;
    }
  }

  @Get('periods')
  async getAllPeriods(
    @Query() query: PaginationQueryDto,
  ): Promise<PaginatedClubPeriodsDto> {
    const started = Date.now();
    const p = query.page;
    const l = query.limit;
    this.logger.log(
      `GET /club-control/periods?page=${p ?? ''}&limit=${l ?? ''}`,
    );
    try {
      const result = await this.clubControlService.getAllPeriods(p, l);
      const paginated = result as PaginatedResult;
      const count = Array.isArray(paginated?.items)
        ? paginated.items.length
        : 0;
      this.logger.log(
        `GET /club-control/periods -> success in ${Date.now() - started}ms count=${count}`,
      );
      return result;
    } catch (err: unknown) {
      this.logger.error(
        `GET /club-control/periods -> error in ${Date.now() - started}ms: ${getErrorMessage(err)}`,
      );
      throw err;
    }
  }

  @Put('periods/:id')
  async updatePeriod(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateClubPeriodDto,
  ): Promise<ClubPeriodResponseDto> {
    const started = Date.now();
    this.logger.log(`PUT /club-control/periods/${id}`);
    try {
      const result = await this.clubControlService.updatePeriod(id, dto);
      this.logger.log(
        `PUT /club-control/periods/${id} -> success in ${Date.now() - started}ms`,
      );
      return result;
    } catch (err: unknown) {
      if (!(err instanceof AppNotFoundException)) {
        this.logger.error(
          `PUT /club-control/periods/${id} -> error in ${Date.now() - started}ms: ${getErrorMessage(err)}`,
        );
      }
      throw err;
    }
  }

  @Delete('periods/:id')
  async deletePeriod(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<DeleteResultDto> {
    const started = Date.now();
    this.logger.log(`DELETE /club-control/periods/${id}`);
    try {
      const result = await this.clubControlService.deletePeriod(id);
      if (!result?.success) {
        this.logger.warn(
          `DELETE /club-control/periods/${id} -> not found in ${Date.now() - started}ms`,
        );
        throw new AppNotFoundException(
          ErrorCode.RESOURCE_NOT_FOUND,
          'Período não encontrado',
        );
      }
      this.logger.log(
        `DELETE /club-control/periods/${id} -> success in ${Date.now() - started}ms`,
      );
      return { success: true };
    } catch (err: unknown) {
      if (!(err instanceof AppNotFoundException)) {
        this.logger.error(
          `DELETE /club-control/periods/${id} -> error in ${Date.now() - started}ms: ${getErrorMessage(err)}`,
        );
      }
      throw err;
    }
  }

  @Post('exceptions')
  async createException(
    @Body() dto: CreateClubExceptionDto,
  ): Promise<ClubExceptionResponseDto> {
    const started = Date.now();
    this.logger.log(
      `POST /club-control/exceptions date=${dto.exceptionDate} type=${dto.type ?? 'other'}`,
    );
    try {
      const result = await this.clubControlService.createException(dto);
      this.logger.log(
        `POST /club-control/exceptions -> success in ${Date.now() - started}ms id=${result?.id ?? 'n/a'}`,
      );
      return result;
    } catch (err: unknown) {
      this.logger.error(
        `POST /club-control/exceptions -> error in ${Date.now() - started}ms: ${getErrorMessage(err)}`,
      );
      throw err;
    }
  }

  @Patch('exceptions/:id')
  async updateException(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateClubExceptionDto,
  ): Promise<ClubExceptionResponseDto> {
    const started = Date.now();
    this.logger.log(`PATCH /club-control/exceptions/${id}`);
    try {
      const result = await this.clubControlService.updateException(id, dto);
      this.logger.log(
        `PATCH /club-control/exceptions/${id} -> success in ${Date.now() - started}ms`,
      );
      return result;
    } catch (err: unknown) {
      if (!(err instanceof AppNotFoundException)) {
        this.logger.error(
          `PATCH /club-control/exceptions/${id} -> error in ${Date.now() - started}ms: ${getErrorMessage(err)}`,
        );
      }
      throw err;
    }
  }

  @Get('exceptions/:date')
  async getExceptionByDate(
    @Param() params: DateParamDto,
  ): Promise<ClubExceptionResponseDto | null> {
    const { date } = params;
    const started = Date.now();
    this.logger.log(`GET /club-control/exceptions/${date}`);
    try {
      const result = await this.clubControlService.getExceptionByDate(date);
      this.logger.log(
        `GET /club-control/exceptions/${date} -> success in ${Date.now() - started}ms found=${!!result}`,
      );
      return result;
    } catch (err: unknown) {
      this.logger.error(
        `GET /club-control/exceptions/${date} -> error in ${Date.now() - started}ms: ${getErrorMessage(err)}`,
      );
      throw err;
    }
  }

  @Get('exceptions')
  async getExceptionsByPeriod(
    @Query() query: ExceptionsQueryDto,
  ): Promise<PaginatedClubExceptionsDto> {
    const started = Date.now();
    const { startDate, endDate, page: p, limit: l } = query;
    this.logger.log(
      `GET /club-control/exceptions?startDate=${startDate ?? ''}&endDate=${endDate ?? ''}&page=${p ?? ''}&limit=${l ?? ''}`,
    );
    try {
      const result = await this.clubControlService.getExceptionsByPeriod(
        startDate,
        endDate,
        p,
        l,
      );
      const paginated = result as PaginatedResult;
      const count = Array.isArray(paginated?.items)
        ? paginated.items.length
        : 0;
      this.logger.log(
        `GET /club-control/exceptions -> success in ${Date.now() - started}ms count=${count}`,
      );
      return result;
    } catch (err: unknown) {
      this.logger.error(
        `GET /club-control/exceptions -> error in ${Date.now() - started}ms: ${getErrorMessage(err)}`,
      );
      throw err;
    }
  }

  @Delete('exceptions/:id')
  async deleteException(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<DeleteResultDto> {
    const started = Date.now();
    this.logger.log(`DELETE /club-control/exceptions/${id}`);
    try {
      const result = await this.clubControlService.deleteException(id);
      if (!result?.success) {
        this.logger.warn(
          `DELETE /club-control/exceptions/${id} -> not found in ${Date.now() - started}ms`,
        );
        throw new AppNotFoundException(
          ErrorCode.RESOURCE_NOT_FOUND,
          'Exceção não encontrada',
        );
      }
      this.logger.log(
        `DELETE /club-control/exceptions/${id} -> success in ${Date.now() - started}ms`,
      );
      return { success: true };
    } catch (err: unknown) {
      if (!(err instanceof AppNotFoundException)) {
        this.logger.error(
          `DELETE /club-control/exceptions/${id} -> error in ${Date.now() - started}ms: ${getErrorMessage(err)}`,
        );
      }
      throw err;
    }
  }

  @Get('check/club/:clubId')
  async checkClubWeek(
    @Param('clubId', ParseUUIDPipe) clubId: string,
    @Query() query: RequiredWeekQueryDto,
  ): Promise<ClubCheckResultDto> {
    const { year, week } = query;
    const started = Date.now();
    this.logger.log(
      `GET /club-control/check/club/${clubId}?year=${year}&week=${week}`,
    );
    try {
      const result = await this.clubControlService.checkClubWeek(
        clubId,
        year,
        week,
      );
      this.logger.log(
        `GET /club-control/check/club/${clubId} -> success in ${Date.now() - started}ms status=${result?.status}`,
      );
      return result;
    } catch (err: unknown) {
      this.logger.error(
        `GET /club-control/check/club/${clubId} -> error in ${Date.now() - started}ms: ${getErrorMessage(err)}`,
      );
      throw err;
    }
  }

  @Get('check/week')
  async checkAllClubsWeek(
    @Query() query: WeekQueryDto,
  ): Promise<ClubsWeekCheckResponseDto> {
    const started = Date.now();

    const DEFAULT_PAGE = 1;
    const DEFAULT_LIMIT = 50;
    const p = query.page ?? DEFAULT_PAGE;
    const l = query.limit ?? DEFAULT_LIMIT;

    let y: number | undefined;
    let w: number | undefined;

    if (query.year !== undefined && query.week !== undefined) {
      y = query.year;
      w = query.week;
      this.logger.log(
        `GET /club-control/check/week?year=${y}&week=${w}&page=${p}&limit=${l}`,
      );
    } else {
      this.logger.log(
        `GET /club-control/check/week (calculando semana atual automaticamente, page=${p}, limit=${l})`,
      );
    }

    try {
      const result = await this.clubControlService.checkAllClubsWeek(
        y,
        w,
        p,
        l,
      );
      const weekCheck = result as WeekCheckResult;
      const listed = Array.isArray(weekCheck?.clubs)
        ? weekCheck.clubs.length
        : 0;
      this.logger.log(
        `GET /club-control/check/week -> success in ${Date.now() - started}ms clubsListed=${listed} total=${weekCheck?.summary?.totalClubs ?? 0} year=${weekCheck?.year} week=${weekCheck?.week}`,
      );
      return result;
    } catch (err: unknown) {
      this.logger.error(
        `GET /club-control/check/week -> error in ${Date.now() - started}ms: ${getErrorMessage(err)}`,
      );
      throw err;
    }
  }

  @Get('dashboard')
  async getCurrentWeekDashboard(
    @Query() query: PaginationQueryDto,
  ): Promise<ClubControlDashboardResponseDto> {
    const started = Date.now();
    this.logger.log(`GET /club-control/dashboard`);
    try {
      const result = await this.clubControlService.getCurrentWeekDashboard(
        query.page ?? 1,
        query.limit ?? 20,
      );
      this.logger.log(
        `GET /club-control/dashboard -> success in ${Date.now() - started}ms clubs=${result?.summary?.totalClubs ?? 0}`,
      );
      return result;
    } catch (err: unknown) {
      this.logger.error(
        `GET /club-control/dashboard -> error in ${Date.now() - started}ms: ${getErrorMessage(err)}`,
      );
      throw err;
    }
  }

  @Get('current-week')
  async getCurrentWeek(): Promise<CurrentAcademicWeekDto | null> {
    const started = Date.now();
    this.logger.log(`GET /club-control/current-week`);
    try {
      const result = await this.clubControlService.getCurrentAcademicWeek();
      this.logger.log(
        `GET /club-control/current-week -> success in ${Date.now() - started}ms`,
      );
      return result;
    } catch (err: unknown) {
      this.logger.error(
        `GET /club-control/current-week -> error in ${Date.now() - started}ms: ${getErrorMessage(err)}`,
      );
      throw err;
    }
  }

  @Get('indicators/detailed')
  async getDetailedIndicators(
    @Query() query: DetailedIndicatorsQueryDto,
  ): Promise<DetailedIndicatorsResultDto> {
    const started = Date.now();
    const y = query.year;
    const w = query.week;
    const filters: DetailedFilters = {};

    if (query.status) filters.status = query.status;
    if (query.severity) filters.severity = query.severity;
    if (query.weekday) filters.weekday = query.weekday;
    if (query.indicatorType) filters.indicatorType = query.indicatorType;
    if (query.hasProblems !== undefined)
      filters.hasProblems = query.hasProblems;
    if (query.page) filters.page = query.page;
    if (query.limit) filters.limit = query.limit;

    this.logger.log(
      `GET /club-control/indicators/detailed?year=${y}&week=${w}&filters=${JSON.stringify(filters)}`,
    );
    try {
      const result = await this.clubControlService.getDetailedIndicators(
        y,
        w,
        Object.keys(filters).length > 0 ? filters : undefined,
      );
      const critical = result?.clubs?.critical?.length || 0;
      const warning = result?.clubs?.warning?.length || 0;
      this.logger.log(
        `GET /club-control/indicators/detailed -> success in ${Date.now() - started}ms critical=${critical} warning=${warning}`,
      );
      return result;
    } catch (err: unknown) {
      this.logger.error(
        `GET /club-control/indicators/detailed -> error in ${Date.now() - started}ms: ${getErrorMessage(err)}`,
      );
      throw err;
    }
  }
}
