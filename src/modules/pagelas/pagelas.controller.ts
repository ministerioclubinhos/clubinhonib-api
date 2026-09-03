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

import { CreatePagelaDto } from './dto/create-pagela.dto';
import { UpdatePagelaDto } from './dto/update-pagela.dto';
import { QueryPagelasDto } from './dto/query-pagelas.dto';
import { PagelaResponseDto } from './dto/pagela-response.dto';
import { CreatePagelasService } from './services/create-pagelas.service';
import { GetPagelasService } from './services/get-pagelas.service';
import { UpdatePagelasService } from './services/update-pagelas.service';
import { DeletePagelasService } from './services/delete-pagelas.service';
import { PagelaAccessContext } from './types';

@Controller('pagelas')
@UseGuards(JwtAuthGuard)
export class PagelasController {
  private readonly logger = new Logger(PagelasController.name);

  constructor(
    private readonly createService: CreatePagelasService,
    private readonly getService: GetPagelasService,
    private readonly updateService: UpdatePagelasService,
    private readonly deleteService: DeletePagelasService,
    private readonly authContext: AuthContextService,
  ) {}

  /**
   * Quem está pedindo. Ler o token é transporte: os casos de uso recebem só o
   * papel e o id, nunca a requisição.
   */
  private async contextOf(request: Request): Promise<PagelaAccessContext> {
    const payload = await this.authContext.tryGetPayload(request);
    return { role: payload?.role?.toLowerCase(), userId: payload?.sub ?? null };
  }

  @Post()
  async create(
    @Body() dto: CreatePagelaDto,
    @Req() request: Request,
  ): Promise<PagelaResponseDto> {
    this.logger.debug('POST /pagelas');
    return this.createService.create(dto, await this.contextOf(request));
  }

  @Get('paginated')
  async findAllPaginated(
    @Query() query: QueryPagelasDto,
    @Req() request: Request,
  ): Promise<Paginated<PagelaResponseDto>> {
    this.logger.debug('GET /pagelas/paginated');
    return this.getService.findAllPaginated(
      query,
      await this.contextOf(request),
    );
  }

  @Get()
  async findAll(
    @Query() query: QueryPagelasDto,
    @Req() request: Request,
  ): Promise<PagelaResponseDto[]> {
    this.logger.debug('GET /pagelas');
    return this.getService.findAll(query, await this.contextOf(request));
  }

  @Get(':id')
  async findOne(
    @Param('id', ParseUUIDPipe) id: string,
    @Req() request: Request,
  ): Promise<PagelaResponseDto> {
    this.logger.debug(`GET /pagelas/${id}`);
    return this.getService.findOne(id, await this.contextOf(request));
  }

  @Patch(':id')
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdatePagelaDto,
    @Req() request: Request,
  ): Promise<PagelaResponseDto> {
    this.logger.debug(`PATCH /pagelas/${id}`);
    return this.updateService.update(id, dto, await this.contextOf(request));
  }

  @Delete(':id')
  async remove(
    @Param('id', ParseUUIDPipe) id: string,
    @Req() request: Request,
  ): Promise<{ message: string }> {
    this.logger.debug(`DELETE /pagelas/${id}`);
    return this.deleteService.remove(id, await this.contextOf(request));
  }
}
