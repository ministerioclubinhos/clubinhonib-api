import { Controller, Get, Post, Body, Param, Query, Delete, Put, NotFoundException, Logger } from '@nestjs/common';
import { ClubControlService } from '../services/club-control.service';
import { CreateClubPeriodDto } from '../dto/create-club-period.dto';
import { UpdateClubPeriodDto } from '../dto/update-club-period.dto';
import { CreateClubExceptionDto } from '../dto/create-club-exception.dto';


@Controller('club-control')
export class ClubControlController {
  private readonly logger = new Logger(ClubControlController.name);

  constructor(private readonly clubControlService: ClubControlService) {}

  

  
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

  
  @Put('periods/:id')
  async updatePeriod(@Param('id') id: string, @Body() dto: UpdateClubPeriodDto) {
    const started = Date.now();
    this.logger.log(`PUT /club-control/periods/${id} dto=${JSON.stringify(dto)}`);
    try {
      const result = await this.clubControlService.updatePeriod(id, dto);
      this.logger.log(`PUT /club-control/periods/${id} -> success in ${Date.now() - started}ms`);
      return result;
    } catch (err: any) {
      if (!(err instanceof NotFoundException)) {
        this.logger.error(`PUT /club-control/periods/${id} -> error in ${Date.now() - started}ms: ${err?.message}`);
      }
      throw err;
    }
  }

  
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

  
  @Delete('exceptions/:id')
  async deleteException(@Param('id') id: string) {
    const started = Date.now();
    this.logger.log(`DELETE /club-control/exceptions/${id}`);
    try {
      const result = await this.clubControlService.deleteException(id);
      if (!result?.success) {
        this.logger.warn(`DELETE /club-control/exceptions/${id} -> not found in ${Date.now() - started}ms`);
        throw new NotFoundException('Exception not found');
      }
      this.logger.log(`DELETE /club-control/exceptions/${id} -> success in ${Date.now() - started}ms`);
      return { success: true };
    } catch (err: any) {
      if (!(err instanceof NotFoundException)) {
        this.logger.error(`DELETE /club-control/exceptions/${id} -> error in ${Date.now() - started}ms: ${err?.message}`);
      }
      throw err;
    }
  }

  

  
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

  
  @Get('check/week')
  async checkAllClubsWeek(
    @Query('year') year?: number,
    @Query('week') week?: number,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ) {
    const started = Date.now();
    
    const DEFAULT_PAGE = 1;
    const DEFAULT_LIMIT = 50;
    const p = page ? Number(page) : DEFAULT_PAGE;
    const l = limit ? Number(limit) : DEFAULT_LIMIT;
    
    
    let y: number | undefined;
    let w: number | undefined;
    
    if (year !== undefined && week !== undefined) {
      
      y = Number(year);
      w = Number(week);
      this.logger.log(`GET /club-control/check/week?year=${y}&week=${w}&page=${p}&limit=${l}`);
    } else {
      
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
