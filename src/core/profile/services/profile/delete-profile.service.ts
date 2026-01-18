import { Injectable, NotFoundException } from '@nestjs/common';
import { UserRepository } from '../../../user/user.repository';
import { PersonalDataRepository } from '../../repositories/personal-data.repository';
import { UserPreferencesRepository } from '../../repositories/user-preferences.repository';

@Injectable()
export class DeleteProfileService {
  constructor(
    private readonly userRepository: UserRepository,
    private readonly personalDataRepository: PersonalDataRepository,
    private readonly userPreferencesRepository: UserPreferencesRepository,
  ) {}

  async execute(userId: string): Promise<void> {
    const user = await this.userRepository.findById(userId);
    if (!user) {
      throw new NotFoundException('User not found');
    }

    await this.personalDataRepository.deleteByUserId(userId);
    await this.userPreferencesRepository.deleteByUserId(userId);
  }
}
