// src/modules/children/children.controller.ts
import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Put,
  Query,
} from '@nestjs/common';
import { ChildrenService } from './children.service';
import { CreateChildDto } from './dto/create-child.dto';
import { UpdateChildDto } from './dto/update-child.dto';
import { QueryChildrenDto, QueryChildrenSimpleDto } from './dto/query-children.dto';
import { PaginatedResponseDto, ChildResponseDto, ChildListItemDto } from './dto/child-response.dto';

@Controller('children')
export class ChildrenController {
  constructor(private readonly service: ChildrenService) {}

  // GET /children?searchString=&clubId=&city=&state=&birthDateFrom=&birthDateTo=&joinedFrom=&joinedTo=&orderBy=&order=&page=&limit=
  @Get()
  async findAll(
    @Query() query: QueryChildrenDto,
  ): Promise<PaginatedResponseDto<ChildResponseDto>> {
    return this.service.findAll(query);
  }

  // GET /children/simple?searchString=&limit=
  @Get('simple')
  async findAllSimples(
    @Query() query: QueryChildrenSimpleDto,
  ): Promise<ChildListItemDto[]> {
    return this.service.findAllSimples(query);
  }

  // GET /children/:id
  @Get(':id')
  async findOne(@Param('id', new ParseUUIDPipe()) id: string): Promise<ChildResponseDto> {
    return this.service.findOne(id);
  }

  // POST /children
  @Post()
  async create(@Body() dto: CreateChildDto): Promise<ChildResponseDto> {
    return this.service.create(dto);
  }

  // PUT /children/:id
  @Put(':id')
  async update(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: UpdateChildDto,
  ): Promise<ChildResponseDto> {
    return this.service.update(id, dto);
  }

  // DELETE /children/:id
  @Delete(':id')
  async remove(@Param('id', new ParseUUIDPipe()) id: string): Promise<{ ok: true }> {
    await this.service.remove(id);
    return { ok: true };
  }
}
