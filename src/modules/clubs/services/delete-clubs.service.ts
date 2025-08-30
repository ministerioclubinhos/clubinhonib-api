// src/modules/clubs/services/delete-clubs.service.ts
import { Injectable } from '@nestjs/common';
import { ClubsRepository } from '../repositories/clubs.repository';

@Injectable()
export class DeleteClubsService {
  constructor(private readonly clubsRepository: ClubsRepository) {}

  async remove(id: string): Promise<{ message: string }> {
    await this.clubsRepository.deleteById(id);
    return { message: 'Club removido com sucesso' };
  }
}
