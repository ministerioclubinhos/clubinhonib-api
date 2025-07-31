// src/modules/pagelas/pagelas.controller.ts
import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { PagelasService } from './pagelas.service';
import { CreatePagelaDto } from './dto/create-pagela.dto';
import { UpdatePagelaDto } from './dto/update-pagela.dto';
import { PagelaFiltersDto } from './dto/pagela-filters.dto';
import { PaginationQueryDto } from './dto/paginated.dto';

@Controller('pagelas')
export class PagelasController {
  constructor(private readonly service: PagelasService) {}

  /** POST /pagelas — cria uma pagela para a semana referente à referenceDate */
  @Post()
  create(@Body() dto: CreatePagelaDto) {
    return this.service.create(dto);
  }

  /** GET /pagelas — lista simples (com filtros opcionais) */
  @Get()
  findAllSimple(@Query() filters: PagelaFiltersDto) {
    return this.service.findAllSimple(filters);
  }

  /** GET /pagelas/paginated — paginação + filtros */
  @Get('paginated')
  findAllPaginated(
    @Query() filters: PagelaFiltersDto,
    @Query() pagination: PaginationQueryDto,
  ) {
    const page = pagination.page ?? 1;
    const limit = pagination.limit ?? 20;
    return this.service.findAllPaginated(filters, page, limit);
  }

  /** GET /pagelas/:id — detalhe */
  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.service.findOne(id);
  }

  /** PATCH /pagelas/:id — atualiza (recalcula week/year se referenceDate mudar) */
  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdatePagelaDto) {
    return this.service.update(id, dto);
  }

  /** DELETE /pagelas/:id — remove */
  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.service.remove(id);
  }
}
