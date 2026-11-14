import { Injectable } from '@nestjs/common';
import { GetUsersService } from 'src/core/user/services/get-user.service';
import { PersonalDataRepository } from '../../repositories/personal-data.repository';
import { UserPreferencesRepository } from '../../repositories/user-preferences.repository';

@Injectable()
export class DeleteProfileService {
  constructor(
    private readonly getUsersService: GetUsersService,
    private readonly personalDataRepository: PersonalDataRepository,
    private readonly userPreferencesRepository: UserPreferencesRepository,
  ) {}

  async execute(userId: string): Promise<void> {
    // Só confirma que o usuário existe: `findOne` falha sozinho quando não.
    await this.getUsersService.findOne(userId);

    await this.personalDataRepository.deleteByUserId(userId);
    await this.userPreferencesRepository.deleteByUserId(userId);
  }
}
