// src/modules/clubs/services/get-clubs.service.ts
import { Injectable, NotFoundException } from '@nestjs/common';
import { ClubsRepository } from '../repositories/clubs.repository';
import { QueryClubsDto } from '../dto/query-clubs.dto';
import {
  ClubResponseDto,
  ClubSimpleResponseDto,
  toClubDto,
  toClubSimpleDto,
} from '../dto/club.response.dto';
import { Paginated } from 'src/share/dto/paginated.dto';
import { ClubSelectOptionDto } from '../dto/club-select-option.dto';

@Injectable()
export class GetClubsService {
  constructor(private readonly clubsRepository: ClubsRepository) { }

  async findAllPaginated(q: QueryClubsDto): Promise<Paginated<ClubResponseDto>> {
    const { page = 1, limit = 10 } = q;

    const { items, total } = await this.clubsRepository.findAllPaginated(q);

    return new Paginated(items.map(toClubDto), total, page, limit);
  }

  async findAllSimple(): Promise<ClubSimpleResponseDto[]> {
    const clubs = await this.clubsRepository.findAllSimple();
    return clubs.map(toClubSimpleDto);
  }

  async findOne(id: string): Promise<ClubResponseDto> {
    const club = await this.clubsRepository.findOneOrFailForResponse(id);
    if (!club) throw new NotFoundException('Club não encontrado');
    return toClubDto(club);
  }

  async list(): Promise<ClubSelectOptionDto[]> {
    return await this.clubsRepository.list();
  }
}
