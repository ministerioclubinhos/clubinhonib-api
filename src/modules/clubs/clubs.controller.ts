import {
  Body,
  Controller,
  Delete,
  Get,
  Logger,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { Request } from 'express';

import { JwtAuthGuard } from 'src/core/auth/guards/jwt-auth.guard';
import { AuthContextService } from 'src/core/auth/services/auth-context.service';
import { Paginated } from 'src/shared/dto/paginated.dto';

import { CreateClubDto } from './dto/create-club.dto';
import { UpdateClubDto } from './dto/update-club.dto';
import { QueryClubsDto } from './dto/query-clubs.dto';
import {
  ClubResponseDto,
  ClubSimpleResponseDto,
} from './dto/club.response.dto';
import { ClubSelectOptionDto } from './dto/club-select-option.dto';
import { CreateClubsService } from './services/create-clubs.service';
import { GetClubsService } from './services/get-clubs.service';
import { UpdateClubsService } from './services/update-clubs.service';
import { DeleteClubsService } from './services/delete-clubs.service';
import { ClubAccessContext } from './types';

@Controller('clubs')
@UseGuards(JwtAuthGuard)
export class ClubsController {
  private readonly logger = new Logger(ClubsController.name);

  constructor(
    private readonly createService: CreateClubsService,
    private readonly getService: GetClubsService,
    private readonly updateService: UpdateClubsService,
    private readonly deleteService: DeleteClubsService,
    private readonly authContext: AuthContextService,
  ) {}

  /**
   * Quem está pedindo. Ler o token é transporte: os casos de uso recebem só o
   * papel e o id, nunca a requisição.
   */
  private async contextOf(request: Request): Promise<ClubAccessContext> {
    const payload = await this.authContext.tryGetPayload(request);
    // O papel vai como veio: normalizar é responsabilidade de `normalizeRole`,
    // que também reconhece papel desconhecido.
    return { role: payload?.role, userId: payload?.sub ?? null };
  }

  @Post()
  async create(
    @Body() dto: CreateClubDto,
    @Req() request: Request,
  ): Promise<ClubResponseDto> {
    this.logger.debug('POST /clubs');
    return this.createService.create(dto, await this.contextOf(request));
  }

  @Get('simple-options')
  async listSimpleOptions(
    @Req() request: Request,
  ): Promise<ClubSelectOptionDto[]> {
    this.logger.debug('GET /clubs/simple-options');
    return this.getService.listOptions(await this.contextOf(request));
  }

  @Get()
  async findAllPaginated(
    @Query() query: QueryClubsDto,
    @Req() request: Request,
  ): Promise<Paginated<ClubResponseDto>> {
    this.logger.debug('GET /clubs');
    return this.getService.findAllPaginated(
      query,
      await this.contextOf(request),
    );
  }

  @Get('all')
  async findAllSimple(
    @Req() request: Request,
  ): Promise<ClubSimpleResponseDto[]> {
    this.logger.debug('GET /clubs/all');
    return this.getService.findAllSimple(await this.contextOf(request));
  }

  @Get(':id')
  async findOne(
    @Param('id', ParseUUIDPipe) id: string,
    @Req() request: Request,
  ): Promise<ClubResponseDto> {
    this.logger.debug(`GET /clubs/${id}`);
    return this.getService.findOne(id, await this.contextOf(request));
  }

  @Patch(':id')
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateClubDto,
    @Req() request: Request,
  ): Promise<ClubResponseDto> {
    this.logger.debug(`PATCH /clubs/${id}`);
    return this.updateService.update(id, dto, await this.contextOf(request));
  }

  @Patch(':id/toggle-active')
  async toggleActive(
    @Param('id', ParseUUIDPipe) id: string,
    @Req() request: Request,
  ): Promise<ClubResponseDto> {
    this.logger.debug(`PATCH /clubs/${id}/toggle-active`);
    return this.updateService.toggleActive(id, await this.contextOf(request));
  }

  @Delete(':id')
  async remove(
    @Param('id', ParseUUIDPipe) id: string,
    @Req() request: Request,
  ): Promise<{ message: string }> {
    this.logger.debug(`DELETE /clubs/${id}`);
    return this.deleteService.remove(id, await this.contextOf(request));
  }
}
