import { Injectable, Logger } from '@nestjs/common';

import { AppNotFoundException, ErrorCode } from 'src/shared/exceptions';
import { MediaItemRepository } from 'src/shared/media/media-item-repository';
import { MediaTargetType } from 'src/shared/media/media-target-type.enum';
import { UserRepository } from 'src/core/user/user.repository';

import { PersonalDataRepository } from '../../repositories/personal-data.repository';
import { UserPreferencesRepository } from '../../repositories/user-preferences.repository';
import { CreateCompleteProfileDto } from '../../dto/create-complete-profile.dto';
import { CompleteProfileResponseDto } from '../../dto/complete-profile-response.dto';
import { toCompleteProfileResponse } from '../../mappers';

@Injectable()
export class CreateProfileService {
  private readonly logger = new Logger(CreateProfileService.name);

  constructor(
    private readonly userRepository: UserRepository,
    private readonly personalDataRepository: PersonalDataRepository,
    private readonly userPreferencesRepository: UserPreferencesRepository,
    private readonly mediaItemRepository: MediaItemRepository,
  ) {}

  async execute(
    userId: string,
    dto: CreateCompleteProfileDto,
  ): Promise<CompleteProfileResponseDto> {
    const user = await this.userRepository.findById(userId);
    if (!user) {
      throw new AppNotFoundException(
        ErrorCode.USER_NOT_FOUND,
        'Usuário não encontrado',
      );
    }

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
      this.mediaItemRepository.findByTarget(userId, MediaTargetType.User),
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
