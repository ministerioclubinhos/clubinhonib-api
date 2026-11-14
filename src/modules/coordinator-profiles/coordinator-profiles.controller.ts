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
  AssignClubDto,
  MoveClubDto,
  UnassignClubDto,
} from './dto/add-club.dto';
import { CoordinatorResponseDto } from './dto/coordinator-profile.response.dto';
import {
  CoordinatorProfilesQueryDto,
  PageDto,
} from './dto/coordinator-profiles.query.dto';
import { CoordinatorSimpleListDto } from './dto/coordinator-simple-list.dto';
import { GetCoordinatorProfilesService } from './services/get-coordinator-profiles.service';
import { UpdateCoordinatorProfilesService } from './services/update-coordinator-profiles.service';

/**
 * Coordenadores e os clubinhos sob sua responsabilidade.
 *
 * Ler o token é transporte: os casos de uso recebem só o papel e o id de quem
 * pediu. Antes nenhuma rota daqui verificava o papel, e qualquer pessoa
 * autenticada — inclusive um professor — listava contatos de toda a estrutura.
 */
@Controller('coordinator-profiles')
@UseGuards(JwtAuthGuard)
export class CoordinatorProfilesController {
  constructor(
    private readonly authContext: AuthContextService,
    private readonly getService: GetCoordinatorProfilesService,
    private readonly updateService: UpdateCoordinatorProfilesService,
  ) {}

  private contextOf(request: Request): Promise<AccessContext> {
    return this.authContext.resolveAccessContext(request);
  }

  @Get()
  async findPage(
    @Req() request: Request,
    @Query() query: CoordinatorProfilesQueryDto,
  ): Promise<PageDto<CoordinatorResponseDto>> {
    return this.getService.findPage(await this.contextOf(request), query);
  }

  @Get('simple')
  async listSimple(
    @Req() request: Request,
  ): Promise<CoordinatorSimpleListDto[]> {
    return this.getService.list(await this.contextOf(request));
  }

  @Get(':id')
  async findOne(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Req() request: Request,
  ): Promise<CoordinatorResponseDto> {
    return this.getService.findOne(await this.contextOf(request), id);
  }

  @Get('by-club/:clubId')
  async findByClubId(
    @Param('clubId', new ParseUUIDPipe()) clubId: string,
    @Req() request: Request,
  ): Promise<CoordinatorResponseDto> {
    return this.getService.findByClubId(await this.contextOf(request), clubId);
  }

  @Patch(':coordinatorId/assign-club')
  async assignClub(
    @Param('coordinatorId', new ParseUUIDPipe()) coordinatorId: string,
    @Body() dto: AssignClubDto,
    @Req() request: Request,
  ): Promise<{ message: string }> {
    await this.updateService.assignClub(
      await this.contextOf(request),
      coordinatorId,
      dto.clubId,
    );

    return { message: 'Clubinho atribuído ao coordenador com sucesso' };
  }

  @Patch(':coordinatorId/unassign-club')
  async unassignClub(
    @Param('coordinatorId', new ParseUUIDPipe()) coordinatorId: string,
    @Body() dto: UnassignClubDto,
    @Req() request: Request,
  ): Promise<{ message: string }> {
    await this.updateService.unassignClub(
      await this.contextOf(request),
      coordinatorId,
      dto.clubId,
    );

    return { message: 'Clubinho removido do coordenador com sucesso' };
  }

  @Patch(':fromCoordinatorId/move-club')
  async moveClub(
    @Param('fromCoordinatorId', new ParseUUIDPipe()) fromCoordinatorId: string,
    @Body() dto: MoveClubDto,
    @Req() request: Request,
  ): Promise<{ message: string }> {
    await this.updateService.moveClub(
      await this.contextOf(request),
      fromCoordinatorId,
      dto.clubId,
      dto.toCoordinatorProfileId,
    );

    return {
      message: 'Clubinho movido para o coordenador de destino com sucesso',
    };
  }
}
