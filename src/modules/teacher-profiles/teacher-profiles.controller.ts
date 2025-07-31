import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Query,
  Req,
} from '@nestjs/common';
import { Request } from 'express';

import { TeacherProfilesService } from './services/teacher-profiles.service';
import {
  AssignTeacherToClubDto,
  UnassignTeacherFromClubDto,
} from './dto/teacher-profile.request.dto';
import { TeacherResponseDto } from './dto/teacher-profile.response.dto';
import { TeacherSimpleListDto } from './dto/teacher-simple-list.dto';
import { PageDto, TeacherProfilesQueryDto } from './dto/teacher-profiles.query.dto';

@Controller('teacher-profiles')
export class TeacherProfilesController {
  constructor(private readonly service: TeacherProfilesService) {}

  /** Lista paginada de teachers (com club + coordinator), com filtros */
  @Get()
  findPage(
    @Req() req: Request,
    @Query() query: TeacherProfilesQueryDto,
  ): Promise<PageDto<TeacherResponseDto>> {
    return this.service.findPage(req, query);
  }

  /** Lista simples (para selects, etc.) */
  @Get('simple')
  listSimple(@Req() req: Request): Promise<TeacherSimpleListDto[]> {
    return this.service.list(req);
  }

  /** Teacher por ID (com club + coordinator) */
  @Get(':id')
  findOne(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Req() req: Request,
  ): Promise<TeacherResponseDto> {
    return this.service.findOne(id, req);
  }

  /** Lista teachers de um club específico (cada item com club + coordinator) */
  @Get('by-club/:clubId')
  findByClubId(
    @Param('clubId', new ParseUUIDPipe()) clubId: string,
    @Req() req: Request,
  ): Promise<TeacherResponseDto[]> {
    return this.service.findByClubId(clubId, req);
  }

  /** Atribui este teacher a um club (um teacher só pode ter 1 club) */
  @Patch(':teacherId/assign-club')
  async assignClub(
    @Param('teacherId', new ParseUUIDPipe()) teacherId: string,
    @Body() dto: AssignTeacherToClubDto,
    @Req() req: Request,
  ): Promise<{ message: string }> {
    await this.service.assignClub(teacherId, dto.clubId, req);
    return { message: 'Teacher atribuído ao club com sucesso' };
  }

  /** Remove este teacher do club atual (club = null) */
  @Patch(':teacherId/unassign-club')
  async unassignClub(
    @Param('teacherId', new ParseUUIDPipe()) teacherId: string,
    @Body() dto: UnassignTeacherFromClubDto,
    @Req() req: Request,
  ): Promise<{ message: string }> {
    await this.service.unassignClub(teacherId, dto.clubId, req);
    return { message: 'Teacher removido do club com sucesso' };
  }
}
