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
  UseGuards,
} from '@nestjs/common';
import { Request } from 'express';

import { ChildrenService } from './children.service';
import { CreateChildDto } from './dto/create-child.dto';
import { UpdateChildDto } from './dto/update-child.dto';
import { QueryChildrenDto, QueryChildrenSimpleDto } from './dto/query-children.dto';
import { PaginatedResponseDto, ChildResponseDto, ChildListItemDto } from './dto/child-response.dto';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';

@Controller('children')
@UseGuards(JwtAuthGuard)
export class ChildrenController {
  constructor(private readonly service: ChildrenService) { }

  @Get()
  async findAll(
    @Query() query: QueryChildrenDto,
    @Req() req: Request,
  ): Promise<PaginatedResponseDto<ChildResponseDto>> {
    return this.service.findAll(query, req);
  }

  @Get('simple')
  async findAllSimples(@Req() req: Request,): Promise<ChildListItemDto[]> {
    return this.service.findAllSimples(req);
  }

  @Get(':id')
  async findOne(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Req() req: Request,
  ): Promise<ChildResponseDto> {
    return this.service.findOne(id, req);
  }

  @Post()
  async create(
    @Body() dto: CreateChildDto,
    @Req() req: Request,
  ): Promise<ChildResponseDto> {
    return this.service.create(dto, req);
  }

  @Put(':id')
  async update(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: UpdateChildDto,
    @Req() req: Request,
  ): Promise<ChildResponseDto> {
    return this.service.update(id, dto, req);
  }

  @Delete(':id')
  async remove(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Req() req: Request,
  ): Promise<{ ok: true }> {
    await this.service.remove(id, req);
    return { ok: true };
  }
}
