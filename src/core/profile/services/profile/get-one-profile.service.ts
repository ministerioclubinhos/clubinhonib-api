import { Injectable, NotFoundException } from '@nestjs/common';
import { UserRepository } from '../../../user/user.repository';
import { PersonalDataRepository } from '../../repositories/personal-data.repository';
import { UserPreferencesRepository } from '../../repositories/user-preferences.repository';
import { CompleteProfileResponseDto } from '../../dto/complete-profile-response.dto';

@Injectable()
export class GetOneProfileService {
  constructor(
    private readonly userRepository: UserRepository,
    private readonly personalDataRepository: PersonalDataRepository,
    private readonly userPreferencesRepository: UserPreferencesRepository,
  ) {}

  async execute(userId: string): Promise<CompleteProfileResponseDto> {
    const user = await this.userRepository.findById(userId);
    if (!user) {
      throw new NotFoundException('User not found');
    }

    const personalData = await this.personalDataRepository.findByUserId(userId);
    const preferences = await this.userPreferencesRepository.findByUserId(userId);

    return {
      id: user.id,
      email: user.email,
      phone: user.phone,
      name: user.name,
      role: user.role,
      personalData: personalData ? {
        birthDate: personalData.birthDate
          ? (personalData.birthDate instanceof Date
              ? personalData.birthDate.toISOString().split('T')[0]
              : String(personalData.birthDate).split('T')[0])
          : undefined,
        gender: personalData.gender,
        gaLeaderName: personalData.gaLeaderName,
        gaLeaderContact: personalData.gaLeaderContact,
      } : undefined,
      preferences: preferences ? {
        loveLanguages: preferences.loveLanguages,
        temperaments: preferences.temperaments,
        favoriteColor: preferences.favoriteColor,
        favoriteFood: preferences.favoriteFood,
        favoriteMusic: preferences.favoriteMusic,
        whatMakesYouSmile: preferences.whatMakesYouSmile,
        skillsAndTalents: preferences.skillsAndTalents,
      } : undefined,
    };
  }
}
