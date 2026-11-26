import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Put,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { Request } from 'express';

import { GetChildrenService } from './services/get-children.service';
import { CreateChildrenService } from './services/create-children.service';
import { UpdateChildrenService } from './services/update-children.service';
import { DeleteChildrenService } from './services/delete-children.service';

import { CreateChildDto } from './dto/create-child.dto';
import { UpdateChildDto } from './dto/update-child.dto';
import {
  QueryChildrenDto,
  QueryChildrenSimpleDto,
} from './dto/query-children.dto';
import {
  PaginatedResponseDto,
  ChildResponseDto,
  ChildListItemDto,
} from './dto/child-response.dto';
import { JwtAuthGuard } from 'src/core/auth/guards/jwt-auth.guard';

@Controller('children')
@UseGuards(JwtAuthGuard)
export class ChildrenController {
  constructor(
    private readonly getService: GetChildrenService,
    private readonly createService: CreateChildrenService,
    private readonly updateService: UpdateChildrenService,
    private readonly deleteService: DeleteChildrenService,
  ) {}

  @Get()
  async findAll(
    @Query() query: QueryChildrenDto,
    @Req() req: Request,
  ): Promise<PaginatedResponseDto<ChildResponseDto>> {
    return this.getService.findAll(query, req);
  }

  @Get('simple')
  async findAllSimples(
    @Query() query: QueryChildrenSimpleDto,
    @Req() req: Request,
  ): Promise<PaginatedResponseDto<ChildListItemDto>> {
    return this.getService.findAllSimples(query, req);
  }

  @Get(':id')
  async findOne(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Req() req: Request,
  ): Promise<ChildResponseDto> {
    return this.getService.findOne(id, req);
  }

  @Post()
  async create(
    @Body() dto: CreateChildDto,
    @Req() req: Request,
  ): Promise<ChildResponseDto> {
    return this.createService.create(dto, req);
  }

  @Put(':id')
  async update(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: UpdateChildDto,
    @Req() req: Request,
  ): Promise<ChildResponseDto> {
    return this.updateService.update(id, dto, req);
  }

  @Delete(':id')
  async remove(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Req() req: Request,
  ): Promise<{ ok: true }> {
    await this.deleteService.remove(id, req);
    return { ok: true };
  }

  @Patch(':id/toggle-active')
  async toggleActive(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Req() req: Request,
  ): Promise<ChildResponseDto> {
    return this.updateService.toggleActive(id, req);
  }
}
