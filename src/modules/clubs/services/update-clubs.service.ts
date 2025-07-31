// src/modules/clubs/services/update-clubs.service.ts
import { Injectable } from '@nestjs/common';
import { ClubsRepository } from '../repositories/clubs.repository';
import { UpdateClubDto } from '../dto/update-club.dto';

@Injectable()
export class UpdateClubsService {
  constructor(private readonly clubsRepository: ClubsRepository) {}

  async update(id: string, dto: UpdateClubDto) {
    return this.clubsRepository.updateClub(id, dto);
  }
}
