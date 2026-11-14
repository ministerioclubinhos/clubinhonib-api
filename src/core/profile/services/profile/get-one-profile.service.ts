import { Injectable } from '@nestjs/common';

import { MediaItemProcessor } from 'src/shared/media/media-item-processor';
import { MediaTargetType } from 'src/shared/media/media-target-type.enum';
import { GetUsersService } from 'src/core/user/services/get-user.service';

import { PersonalDataRepository } from '../../repositories/personal-data.repository';
import { UserPreferencesRepository } from '../../repositories/user-preferences.repository';
import { CompleteProfileResponseDto } from '../../dto/complete-profile-response.dto';
import { toCompleteProfileResponse } from '../../mappers';

@Injectable()
export class GetOneProfileService {
  constructor(
    private readonly getUsersService: GetUsersService,
    private readonly personalDataRepository: PersonalDataRepository,
    private readonly userPreferencesRepository: UserPreferencesRepository,
    private readonly mediaItemProcessor: MediaItemProcessor,
  ) {}

  async execute(userId: string): Promise<CompleteProfileResponseDto> {
    const user = await this.getUsersService.findOne(userId);

    const [personalData, preferences, [image]] = await Promise.all([
      this.personalDataRepository.findByUserId(userId),
      this.userPreferencesRepository.findByUserId(userId),
      this.mediaItemProcessor.findMediaItemsByTarget(
        userId,
        MediaTargetType.User,
      ),
    ]);

    return toCompleteProfileResponse({
      user,
      image,
      personalData,
      preferences,
    });
  }
}
