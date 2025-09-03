// src/modules/coordinator-profiles/coordinator-profiles.controller.ts
import {
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Body,
  Query,
} from '@nestjs/common';

import { CoordinatorProfilesService } from './services/coordinator-profiles.service';
import { CoordinatorResponseDto } from './dto/coordinator-profile.response.dto';
import { AssignClubDto, MoveClubDto, UnassignClubDto } from './dto/add-club.dto';
import { CoordinatorSimpleListDto } from './dto/coordinator-simple-list.dto';
import { CoordinatorProfilesQueryDto, PageDto } from './dto/coordinator-profiles.query.dto';

@Controller('coordinator-profiles')
export class CoordinatorProfilesController {
  constructor(private readonly service: CoordinatorProfilesService) { }

  /** Lista paginada de coordenadores (com clubs + teachers), com filtros */
  @Get()
  findPage(
    @Query() query: CoordinatorProfilesQueryDto,
  ): Promise<PageDto<CoordinatorResponseDto>> {
    return this.service.findPage(query);
  }

  @Get('simple')
  listSimple(): Promise<CoordinatorSimpleListDto[]> {
    return this.service.list();
  }


  /** Busca um coordinator por id (com clubs + teachers) */
  @Get(':id')
  findOne(@Param('id', new ParseUUIDPipe()) id: string): Promise<CoordinatorResponseDto> {
    return this.service.findOne(id);
  }

  /** Retorna o coordinator de um club específico */
  @Get('by-club/:clubId')
  findByClubId(@Param('clubId', new ParseUUIDPipe()) clubId: string): Promise<CoordinatorResponseDto> {
    return this.service.findByClubId(clubId);
  }

  /** Atribui um club a este coordinator */
  @Patch(':coordinatorId/assign-club')
  async assignClub(
    @Param('coordinatorId', new ParseUUIDPipe()) coordinatorId: string,
    @Body() dto: AssignClubDto,
  ): Promise<{ message: string }> {
    await this.service.assignClub(coordinatorId, dto.clubId);
    return { message: 'Club atribuído ao coordenador com sucesso' };
  }

  /** Remove um club deste coordinator (coordinator do club fica null) */
  @Patch(':coordinatorId/unassign-club')
  async unassignClub(
    @Param('coordinatorId', new ParseUUIDPipe()) coordinatorId: string,
    @Body() dto: UnassignClubDto,
  ): Promise<{ message: string }> {
    await this.service.unassignClub(coordinatorId, dto.clubId);
    return { message: 'Club removido do coordenador com sucesso' };
  }

  /** Move um club deste coordinator para outro coordinator */
  @Patch(':fromCoordinatorId/move-club')
  async moveClub(
    @Param('fromCoordinatorId', new ParseUUIDPipe()) fromCoordinatorId: string,
    @Body() dto: MoveClubDto,
  ): Promise<{ message: string }> {
    await this.service.moveClub(fromCoordinatorId, dto.clubId, dto.toCoordinatorProfileId);
    return { message: 'Club movido para o coordenador de destino com sucesso' };
  }
}
