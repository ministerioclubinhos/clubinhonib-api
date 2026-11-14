import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Logger,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { Request } from 'express';

import { Paginated } from 'src/shared/dto/paginated.dto';

import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AdminRoleGuard } from '../auth/guards/role-guard';
import { AuthContextService } from '../auth/services/auth-context.service';

import { CreateFeatureFlagDto } from './dto/create-feature-flag.dto';
import { UpdateFeatureFlagDto } from './dto/update-feature-flag.dto';
import { QueryFeatureFlagsDto } from './dto/query-feature-flags.dto';
import { FeatureFlagResponseDto } from './dto/feature-flag-response.dto';
import { FeatureFlagStatsDto } from './dto/feature-flag-stats.dto';
import { CreateFeatureFlagService } from './services/create-feature-flag.service';
import { GetFeatureFlagsService } from './services/get-feature-flags.service';
import { UpdateFeatureFlagService } from './services/update-feature-flag.service';
import { DeleteFeatureFlagService } from './services/delete-feature-flag.service';

@Controller('feature-flags')
export class FeatureFlagsController {
  private readonly logger = new Logger(FeatureFlagsController.name);

  constructor(
    private readonly createService: CreateFeatureFlagService,
    private readonly getService: GetFeatureFlagsService,
    private readonly updateService: UpdateFeatureFlagService,
    private readonly deleteService: DeleteFeatureFlagService,
    private readonly authContext: AuthContextService,
  ) {}

  @UseGuards(JwtAuthGuard, AdminRoleGuard)
  @Post()
  async create(
    @Body() dto: CreateFeatureFlagDto,
  ): Promise<FeatureFlagResponseDto> {
    this.logger.debug(`POST /feature-flags | key=${dto.key}`);
    return this.createService.create(dto);
  }

  /** Acerta o catálogo: cria o que falta e apaga o que foi aposentado. */
  @UseGuards(JwtAuthGuard, AdminRoleGuard)
  @Post('seed')
  async seed(): Promise<{
    message: string;
    count: number;
    created: FeatureFlagResponseDto[];
    retired: string[];
  }> {
    this.logger.debug('POST /feature-flags/seed');

    const { created, retired } = await this.createService.synchronizeCatalog();

    return {
      message: 'Catálogo de feature flags conferido',
      count: created.length,
      created,
      retired,
    };
  }

  /**
   * Listagem do painel.
   *
   * Exige administrador: a lista descreve a configuração inteira do produto,
   * inclusive as flags desligadas e a quem cada uma se aplica.
   */
  @UseGuards(JwtAuthGuard, AdminRoleGuard)
  @Get()
  async findAll(
    @Query() query: QueryFeatureFlagsDto,
  ): Promise<Paginated<FeatureFlagResponseDto>> {
    this.logger.debug('GET /feature-flags');
    return this.getService.findAllPaginated(query);
  }

  /** Resumo do acervo, exibido no cabeçalho do painel. */
  @UseGuards(JwtAuthGuard, AdminRoleGuard)
  @Get('stats')
  async stats(): Promise<FeatureFlagStatsDto> {
    this.logger.debug('GET /feature-flags/stats');
    return this.getService.getStats();
  }

  /**
   * As flags que valem para quem está pedindo.
   *
   * O perfil vem da sessão, nunca da query: aceitar `?role=` deixava qualquer
   * pessoa pedir o mapa de um administrador.
   */
  @Get('map')
  async getFlagsMap(@Req() request: Request): Promise<Record<string, boolean>> {
    const role = await this.authContext.getRole(request);
    this.logger.debug(`GET /feature-flags/map | role=${role ?? 'visitante'}`);
    return this.getService.getFlagsMap(role);
  }

  /** Situação de uma única flag para quem está pedindo. */
  @Get('check/:key')
  async check(
    @Param('key') key: string,
    @Req() request: Request,
  ): Promise<{ key: string; enabled: boolean }> {
    const role = await this.authContext.getRole(request);
    return { key, enabled: await this.getService.isEnabled(key, role) };
  }

  @UseGuards(JwtAuthGuard, AdminRoleGuard)
  @Get(':key')
  async findOne(@Param('key') key: string): Promise<FeatureFlagResponseDto> {
    this.logger.debug(`GET /feature-flags/${key}`);
    return this.getService.findOne(key);
  }

  @UseGuards(JwtAuthGuard, AdminRoleGuard)
  @Patch(':key')
  async update(
    @Param('key') key: string,
    @Body() dto: UpdateFeatureFlagDto,
  ): Promise<FeatureFlagResponseDto> {
    this.logger.debug(`PATCH /feature-flags/${key}`);
    return this.updateService.update(key, dto);
  }

  @UseGuards(JwtAuthGuard, AdminRoleGuard)
  @Patch(':key/toggle')
  async toggle(@Param('key') key: string): Promise<FeatureFlagResponseDto> {
    this.logger.debug(`PATCH /feature-flags/${key}/toggle`);
    return this.updateService.toggle(key);
  }

  @UseGuards(JwtAuthGuard, AdminRoleGuard)
  @Delete(':key')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@Param('key') key: string): Promise<void> {
    this.logger.debug(`DELETE /feature-flags/${key}`);
    await this.deleteService.remove(key);
  }
}
