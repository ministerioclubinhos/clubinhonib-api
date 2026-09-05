import { Injectable, Logger } from '@nestjs/common';

import { MediaItemProcessor } from 'src/shared/media/media-item-processor';
import { MediaTargetType } from 'src/shared/media/media-target-type.enum';
import { GetUsersService } from 'src/core/user/services/get-user.service';

import { PersonalDataRepository } from '../../repositories/personal-data.repository';
import { UserPreferencesRepository } from '../../repositories/user-preferences.repository';
import { CreateCompleteProfileDto } from '../../dto/create-complete-profile.dto';
import { CompleteProfileResponseDto } from '../../dto/complete-profile-response.dto';
import { toCompleteProfileResponse } from '../../mappers';

@Injectable()
export class CreateProfileService {
  private readonly logger = new Logger(CreateProfileService.name);

  constructor(
    private readonly getUsersService: GetUsersService,
    private readonly personalDataRepository: PersonalDataRepository,
    private readonly userPreferencesRepository: UserPreferencesRepository,
    private readonly mediaItemProcessor: MediaItemProcessor,
  ) {}

  async execute(
    userId: string,
    dto: CreateCompleteProfileDto,
  ): Promise<CompleteProfileResponseDto> {
    const user = await this.getUsersService.findOne(userId);

    // Cada bloco é opcional, e o que já existir é atualizado em vez de
    // duplicado: o perfil é um por usuário.
    if (dto.personalData) {
      const existing = await this.personalDataRepository.findByUserId(userId);
      await (existing
        ? this.personalDataRepository.updateByUserId(userId, dto.personalData)
        : this.personalDataRepository.createForUser(userId, dto.personalData));
    }

    if (dto.preferences) {
      const existing =
        await this.userPreferencesRepository.findByUserId(userId);
      await (existing
        ? this.userPreferencesRepository.updateByUserId(userId, dto.preferences)
        : this.userPreferencesRepository.createForUser(
            userId,
            dto.preferences,
          ));
    }

    const [personalData, preferences, [image]] = await Promise.all([
      this.personalDataRepository.findByUserId(userId),
      this.userPreferencesRepository.findByUserId(userId),
      this.mediaItemProcessor.findMediaItemsByTarget(
        userId,
        MediaTargetType.User,
      ),
    ]);

    this.logger.log(`Perfil criado para o usuário: ${userId}`);

    return toCompleteProfileResponse({
      user,
      image,
      personalData,
      preferences,
    });
  }
}
