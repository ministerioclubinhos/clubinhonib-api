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
  Req,
} from '@nestjs/common';
import { Request } from 'express';

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
    @Req() req: Request,
  ): Promise<PaginatedResponseDto<ChildResponseDto>> {
    return this.service.findAll(query, req);
  }

  // GET /children/simple?searchString=&limit=
  @Get('simple')
  async findAllSimples(
    @Query() query: QueryChildrenSimpleDto,
    @Req() req: Request,
  ): Promise<ChildListItemDto[]> {
    return this.service.findAllSimples(query, req);
  }

  // GET /children/:id
  @Get(':id')
  async findOne(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Req() req: Request,
  ): Promise<ChildResponseDto> {
    return this.service.findOne(id, req);
  }

  // POST /children
  @Post()
  async create(
    @Body() dto: CreateChildDto,
    @Req() req: Request,
  ): Promise<ChildResponseDto> {
    return this.service.create(dto, req);
  }

  // PUT /children/:id
  @Put(':id')
  async update(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: UpdateChildDto,
    @Req() req: Request,
  ): Promise<ChildResponseDto> {
    return this.service.update(id, dto, req);
  }

  // DELETE /children/:id
  @Delete(':id')
  async remove(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Req() req: Request,
  ): Promise<{ ok: true }> {
    await this.service.remove(id, req);
    return { ok: true };
  }
}
