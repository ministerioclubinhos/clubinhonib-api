// src/modules/clubs/services/create-clubs.service.ts
import { Injectable } from '@nestjs/common';
import { ClubsRepository } from '../repositories/clubs.repository';
import { CreateClubDto } from '../dto/create-club.dto';

@Injectable()
export class CreateClubsService {
  constructor(private readonly clubsRepository: ClubsRepository) {}

  async create(dto: CreateClubDto) {
    return this.clubsRepository.createClub(dto);
  }
}
