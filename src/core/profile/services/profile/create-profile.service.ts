import { Injectable, NotFoundException } from '@nestjs/common';
import { UserRepository } from '../../../user/user.repository';
import { PersonalDataRepository } from '../../repositories/personal-data.repository';
import { UserPreferencesRepository } from '../../repositories/user-preferences.repository';
import { CreateCompleteProfileDto } from '../../dto/create-complete-profile.dto';
import { CompleteProfileResponseDto } from '../../dto/complete-profile-response.dto';

@Injectable()
export class CreateProfileService {
  constructor(
    private readonly userRepository: UserRepository,
    private readonly personalDataRepository: PersonalDataRepository,
    private readonly userPreferencesRepository: UserPreferencesRepository,
  ) {}

  async execute(userId: string, dto: CreateCompleteProfileDto): Promise<CompleteProfileResponseDto> {
    const user = await this.userRepository.findById(userId);
    if (!user) {
      throw new NotFoundException('User not found');
    }

    let personalData: Awaited<ReturnType<typeof this.personalDataRepository.findByUserId>> = null;
    let preferences: Awaited<ReturnType<typeof this.userPreferencesRepository.findByUserId>> = null;

    if (dto.personalData) {
      const existing = await this.personalDataRepository.findByUserId(userId);
      const dataToSave = {
        ...dto.personalData,
        birthDate: dto.personalData.birthDate ? new Date(dto.personalData.birthDate) : undefined,
      };
      if (existing) {
        personalData = await this.personalDataRepository.updateByUserId(userId, dataToSave);
      } else {
        personalData = await this.personalDataRepository.createForUser(userId, dataToSave);
      }
    }

    if (dto.preferences) {
      const existing = await this.userPreferencesRepository.findByUserId(userId);
      if (existing) {
        preferences = await this.userPreferencesRepository.updateByUserId(userId, dto.preferences);
      } else {
        preferences = await this.userPreferencesRepository.createForUser(userId, dto.preferences);
      }
    }

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
