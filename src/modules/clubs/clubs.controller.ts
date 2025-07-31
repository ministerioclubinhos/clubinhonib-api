// src/modules/clubs/clubs.controller.ts
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
} from '@nestjs/common';
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

@Controller('clubs')
export class ClubsController {
  constructor(
    private readonly deleteService: DeleteClubsService,
    private readonly updateService: UpdateClubsService,
    private readonly getService: GetClubsService,
    private readonly createService: CreateClubsService,
  ) { }

  @Post()
  create(@Body() dto: CreateClubDto) {
    return this.createService.create(dto);
  }

  @Get('simple-options')
  listSimpleOptions(): Promise<ClubSelectOptionDto[]> {
    return this.getService.list();
  }

  @Get()
  findAllPaginated(@Query() q: QueryClubsDto): Promise<Paginated<ClubResponseDto>> {
    return this.getService.findAllPaginated(q);
  }

  @Get('all')
  findAllSimple(): Promise<ClubSimpleResponseDto[]> {
    return this.getService.findAllSimple();
  }

  @Get(':id')
  findOne(@Param('id', new ParseUUIDPipe()) id: string): Promise<ClubResponseDto> {
    return this.getService.findOne(id);
  }

  @Patch(':id')
  update(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: UpdateClubDto,
  ) {
    return this.updateService.update(id, dto);
  }

  @Delete(':id')
  remove(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.deleteService.remove(id);
  }
}
