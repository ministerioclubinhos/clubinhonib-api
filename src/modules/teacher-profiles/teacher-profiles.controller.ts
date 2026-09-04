import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { Request } from 'express';

import { AccessContext } from 'src/core/auth/auth.types';
import { JwtAuthGuard } from 'src/core/auth/guards/jwt-auth.guard';
import { AuthContextService } from 'src/core/auth/services/auth-context.service';

import {
  AssignTeacherToClubDto,
  UnassignTeacherFromClubDto,
} from './dto/teacher-profile.request.dto';
import { TeacherResponseDto } from './dto/teacher-profile.response.dto';
import { TeacherSimpleListDto } from './dto/teacher-simple-list.dto';
import {
  PageDto,
  TeacherProfilesQueryDto,
} from './dto/teacher-profiles.query.dto';
import { GetTeacherProfilesService } from './services/get-teacher-profiles.service';
import { UpdateTeacherProfilesService } from './services/update-teacher-profiles.service';

/**
 * Professores e o clubinho em que atuam.
 *
 * Ler o token é transporte: os casos de uso recebem só o papel e o id de quem
 * pediu.
 */
@Controller('teacher-profiles')
@UseGuards(JwtAuthGuard)
export class TeacherProfilesController {
  constructor(
    private readonly authContext: AuthContextService,
    private readonly getService: GetTeacherProfilesService,
    private readonly updateService: UpdateTeacherProfilesService,
  ) {}

  private contextOf(request: Request): Promise<AccessContext> {
    return this.authContext.resolveAccessContext(request);
  }

  @Get()
  async findPage(
    @Req() request: Request,
    @Query() query: TeacherProfilesQueryDto,
  ): Promise<PageDto<TeacherResponseDto>> {
    return this.getService.findPage(await this.contextOf(request), query);
  }

  @Get('simple')
  async listSimple(@Req() request: Request): Promise<TeacherSimpleListDto[]> {
    return this.getService.list(await this.contextOf(request));
  }

  @Get(':id')
  async findOne(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Req() request: Request,
  ): Promise<TeacherResponseDto> {
    return this.getService.findOne(await this.contextOf(request), id);
  }

  @Get('by-club/:clubId')
  async findByClubId(
    @Param('clubId', new ParseUUIDPipe()) clubId: string,
    @Req() request: Request,
  ): Promise<TeacherResponseDto[]> {
    return this.getService.findByClubId(await this.contextOf(request), clubId);
  }

  @Patch(':teacherId/assign-club')
  async assignClub(
    @Param('teacherId', new ParseUUIDPipe()) teacherId: string,
    @Body() dto: AssignTeacherToClubDto,
    @Req() request: Request,
  ): Promise<{ message: string }> {
    await this.updateService.assignClub(
      await this.contextOf(request),
      teacherId,
      dto.clubId,
    );

    return { message: 'Professor vinculado ao clubinho com sucesso' };
  }

  @Patch(':teacherId/unassign-club')
  async unassignClub(
    @Param('teacherId', new ParseUUIDPipe()) teacherId: string,
    @Body() dto: UnassignTeacherFromClubDto,
    @Req() request: Request,
  ): Promise<{ message: string }> {
    await this.updateService.unassignClub(
      await this.contextOf(request),
      teacherId,
      dto.clubId,
    );

    return { message: 'Professor desvinculado do clubinho com sucesso' };
  }
}
