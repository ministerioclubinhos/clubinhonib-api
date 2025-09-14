import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  ParseUUIDPipe,
  Req,
  UseGuards,
} from '@nestjs/common';
import { Request } from 'express';

import { UpdateClubDto } from './dto/update-club.dto';
import { QueryClubsDto } from './dto/query-clubs.dto';
import { CreateClubDto } from './dto/create-club.dto';
import { DeleteClubsService } from './services/delete-clubs.service';
import { UpdateClubsService } from './services/update-clubs.service';
import { GetClubsService } from './services/get-clubs.service';
import { CreateClubsService } from './services/create-clubs.service';
import { Paginated } from 'src/share/dto/paginated.dto';
import { ClubResponseDto, ClubSimpleResponseDto } from './dto/club.response.dto';
import { ClubSelectOptionDto } from './dto/club-select-option.dto';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';

@Controller('clubs')
@UseGuards(JwtAuthGuard)
export class ClubsController {
  constructor(
    private readonly deleteService: DeleteClubsService,
    private readonly updateService: UpdateClubsService,
    private readonly getService: GetClubsService,
    private readonly createService: CreateClubsService,
  ) { }

  @Post()
  create(@Body() dto: CreateClubDto, @Req() req: Request) {
    return this.createService.create(dto, req);
  }

  @Get('simple-options')
  listSimpleOptions(@Req() req: Request): Promise<ClubSelectOptionDto[]> {
    return this.getService.list(req);
  }

  @Get()
  findAllPaginated(
    @Query() q: QueryClubsDto,
    @Req() req: Request,
  ): Promise<Paginated<ClubResponseDto>> {
    return this.getService.findAllPaginated(q, req);
  }

  @Get('all')
  findAllSimple(@Req() req: Request): Promise<ClubSimpleResponseDto[]> {
    return this.getService.findAllSimple(req);
  }

  @Get(':id')
  findOne(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Req() req: Request,
  ): Promise<ClubResponseDto> {
    return this.getService.findOne(id, req);
  }

  @Patch(':id')
  update(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: UpdateClubDto,
    @Req() req: Request,
  ) {
    return this.updateService.update(id, dto, req);
  }

  @Delete(':id')
  remove(@Param('id', new ParseUUIDPipe()) id: string, @Req() req: Request) {
    return this.deleteService.remove(id, req);
  }
}
