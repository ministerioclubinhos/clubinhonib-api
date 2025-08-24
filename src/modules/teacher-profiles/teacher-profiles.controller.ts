// src/modules/teacher-profiles/teacher-profiles.controller.ts
import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
} from '@nestjs/common';

import { TeacherProfilesService } from './services/teacher-profiles.service';
import {
  AssignTeacherToClubDto,
  UnassignTeacherFromClubDto,
} from './dto/teacher-profile.request.dto';
import { TeacherResponseDto } from './dto/teacher-profile.response.dto';

@Controller('teacher-profiles')
export class TeacherProfilesController {
  constructor(private readonly service: TeacherProfilesService) {}

  /** Lista todos os teachers com seu club (e coordinator dentro do club) */
  @Get()
  findAll(): Promise<TeacherResponseDto[]> {
    return this.service.findAll();
  }

  /** Teacher por ID (com club + coordinator) */
  @Get(':id')
  findOne(@Param('id', new ParseUUIDPipe()) id: string): Promise<TeacherResponseDto> {
    return this.service.findOne(id);
  }

  /** Lista teachers de um club específico (cada item com club + coordinator) */
  @Get('by-club/:clubId')
  findByClubId(
    @Param('clubId', new ParseUUIDPipe()) clubId: string,
  ): Promise<TeacherResponseDto[]> {
    return this.service.findByClubId(clubId);
  }

  /** Atribui este teacher a um club (um teacher só pode ter 1 club) */
  @Patch(':teacherId/assign-club')
  async assignClub(
    @Param('teacherId', new ParseUUIDPipe()) teacherId: string,
    @Body() dto: AssignTeacherToClubDto,
  ): Promise<{ message: string }> {
    await this.service.assignClub(teacherId, dto.clubId);
    return { message: 'Teacher atribuído ao club com sucesso' };
  }

  /** Remove este teacher do club atual (club = null) */
  @Patch(':teacherId/unassign-club')
  async unassignClub(
    @Param('teacherId', new ParseUUIDPipe()) teacherId: string,
    @Body() dto: UnassignTeacherFromClubDto,
  ): Promise<{ message: string }> {
    await this.service.unassignClub(teacherId, dto.clubId);
    return { message: 'Teacher removido do club com sucesso' };
  }
}
