import { Injectable } from '@nestjs/common';

import { AppNotFoundException, ErrorCode } from 'src/shared/exceptions';
import { MediaItemRepository } from 'src/shared/media/media-item-repository';
import { MediaTargetType } from 'src/shared/media/media-target-type.enum';
import { UserRepository } from 'src/core/user/user.repository';

import { PersonalDataRepository } from '../../repositories/personal-data.repository';
import { UserPreferencesRepository } from '../../repositories/user-preferences.repository';
import { CompleteProfileResponseDto } from '../../dto/complete-profile-response.dto';
import { toCompleteProfileResponse } from '../../mappers';

@Injectable()
export class GetOneProfileService {
  constructor(
    private readonly userRepository: UserRepository,
    private readonly personalDataRepository: PersonalDataRepository,
    private readonly userPreferencesRepository: UserPreferencesRepository,
    private readonly mediaItemRepository: MediaItemRepository,
  ) {}

  async execute(userId: string): Promise<CompleteProfileResponseDto> {
    const user = await this.userRepository.findById(userId);
    if (!user) {
      throw new AppNotFoundException(
        ErrorCode.USER_NOT_FOUND,
        'Usuário não encontrado',
      );
    }

    const [personalData, preferences, [image]] = await Promise.all([
      this.personalDataRepository.findByUserId(userId),
      this.userPreferencesRepository.findByUserId(userId),
      this.mediaItemRepository.findByTarget(userId, MediaTargetType.User),
    ]);

    return toCompleteProfileResponse({
      user,
      image,
      personalData,
      preferences,
    });
  }
}
