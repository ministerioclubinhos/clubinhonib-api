import {
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Body,
  Query,
  UseGuards,
} from '@nestjs/common';
import { CoordinatorProfilesService } from './services/coordinator-profiles.service';
import { CoordinatorResponseDto } from './dto/coordinator-profile.response.dto';
import { AssignClubDto, MoveClubDto, UnassignClubDto } from './dto/add-club.dto';
import { CoordinatorSimpleListDto } from './dto/coordinator-simple-list.dto';
import { CoordinatorProfilesQueryDto, PageDto } from './dto/coordinator-profiles.query.dto';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';

@Controller('coordinator-profiles')
@UseGuards(JwtAuthGuard)
export class CoordinatorProfilesController {
  constructor(private readonly service: CoordinatorProfilesService) { }

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

  @Get(':id')
  findOne(@Param('id', new ParseUUIDPipe()) id: string): Promise<CoordinatorResponseDto> {
    return this.service.findOne(id);
  }

  @Get('by-club/:clubId')
  findByClubId(@Param('clubId', new ParseUUIDPipe()) clubId: string): Promise<CoordinatorResponseDto> {
    return this.service.findByClubId(clubId);
  }

  @Patch(':coordinatorId/assign-club')
  async assignClub(
    @Param('coordinatorId', new ParseUUIDPipe()) coordinatorId: string,
    @Body() dto: AssignClubDto,
  ): Promise<{ message: string }> {
    await this.service.assignClub(coordinatorId, dto.clubId);
    return { message: 'Club atribuído ao coordenador com sucesso' };
  }

  @Patch(':coordinatorId/unassign-club')
  async unassignClub(
    @Param('coordinatorId', new ParseUUIDPipe()) coordinatorId: string,
    @Body() dto: UnassignClubDto,
  ): Promise<{ message: string }> {
    await this.service.unassignClub(coordinatorId, dto.clubId);
    return { message: 'Club removido do coordenador com sucesso' };
  }

  @Patch(':fromCoordinatorId/move-club')
  async moveClub(
    @Param('fromCoordinatorId', new ParseUUIDPipe()) fromCoordinatorId: string,
    @Body() dto: MoveClubDto,
  ): Promise<{ message: string }> {
    await this.service.moveClub(fromCoordinatorId, dto.clubId, dto.toCoordinatorProfileId);
    return { message: 'Club movido para o coordenador de destino com sucesso' };
  }
}
