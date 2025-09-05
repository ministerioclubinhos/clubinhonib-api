import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { PagelasService } from './pagelas.service';
import { CreatePagelaDto } from './dto/create-pagela.dto';
import { UpdatePagelaDto } from './dto/update-pagela.dto';
import { PagelaFiltersDto } from './dto/pagela-filters.dto';
import { PaginationQueryDto } from './dto/paginated.dto';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';

@Controller('pagelas')
@UseGuards(JwtAuthGuard)
export class PagelasController {
  constructor(private readonly service: PagelasService) {}

  @Post()
  create(@Body() dto: CreatePagelaDto) {
    return this.service.create(dto);
  }

  @Get()
  findAllSimple(@Query() filters: PagelaFiltersDto) {
    return this.service.findAllSimple(filters);
  }

  @Get('paginated')
  findAllPaginated(
    @Query() filters: PagelaFiltersDto,
    @Query() pagination: PaginationQueryDto,
  ) {
    const page = pagination.page ?? 1;
    const limit = pagination.limit ?? 20;
    return this.service.findAllPaginated(filters, page, limit);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.service.findOne(id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdatePagelaDto) {
    return this.service.update(id, dto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.service.remove(id);
  }
}
