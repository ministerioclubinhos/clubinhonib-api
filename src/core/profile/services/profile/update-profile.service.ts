import { Injectable, Logger } from '@nestjs/common';

import { MediaItemProcessor } from 'src/shared/media/media-item-processor';
import { MediaTargetType } from 'src/shared/media/media-target-type.enum';
import { GetUsersService } from 'src/core/user/services/get-user.service';

import { PersonalDataRepository } from '../../repositories/personal-data.repository';
import { UserPreferencesRepository } from '../../repositories/user-preferences.repository';
import { UpdateCompleteProfileDto } from '../../dto/update-complete-profile.dto';
import { CompleteProfileResponseDto } from '../../dto/complete-profile-response.dto';
import { toCompleteProfileResponse } from '../../mappers';
import { PersonalData } from '../../entities/personal-data.entity';
import { UserPreferences } from '../../entities/user-preferences.entity';
import { UpdatePersonalDataDto } from '../../dto/update-personal-data.dto';
import { UpdateUserPreferencesDto } from '../../dto/update-user-preferences.dto';

@Injectable()
export class UpdateProfileService {
  private readonly logger = new Logger(UpdateProfileService.name);

  constructor(
    private readonly getUsersService: GetUsersService,
    private readonly personalDataRepository: PersonalDataRepository,
    private readonly userPreferencesRepository: UserPreferencesRepository,
    private readonly mediaItemProcessor: MediaItemProcessor,
  ) {}

  async execute(
    userId: string,
    dto: UpdateCompleteProfileDto,
  ): Promise<CompleteProfileResponseDto> {
    const user = await this.getUsersService.findOne(userId);

    const personalData = await this.savePersonalData(userId, dto.personalData);
    const preferences = await this.savePreferences(userId, dto.preferences);
    const [image] = await this.mediaItemProcessor.findMediaItemsByTarget(
      userId,
      MediaTargetType.User,
    );

    this.logger.log(`Perfil atualizado para o usuário: ${userId}`);

    return toCompleteProfileResponse({
      user,
      image,
      personalData,
      preferences,
    });
  }

  /**
   * Grava os dados pessoais, criando o registro na primeira vez.
   *
   * Sem `personalData` no corpo, devolve o que já está gravado: a resposta
   * mostra o perfil inteiro, mesmo quando a edição mexeu só nas preferências.
   */
  private async savePersonalData(
    userId: string,
    dto?: UpdatePersonalDataDto,
  ): Promise<PersonalData | null> {
    if (!dto) return this.personalDataRepository.findByUserId(userId);

    const existing = await this.personalDataRepository.findByUserId(userId);

    return existing
      ? this.personalDataRepository.updateByUserId(userId, dto)
      : this.personalDataRepository.createForUser(userId, dto);
  }

  private async savePreferences(
    userId: string,
    dto?: UpdateUserPreferencesDto,
  ): Promise<UserPreferences | null> {
    if (!dto) return this.userPreferencesRepository.findByUserId(userId);

    const existing = await this.userPreferencesRepository.findByUserId(userId);

    return existing
      ? this.userPreferencesRepository.updateByUserId(userId, dto)
      : this.userPreferencesRepository.createForUser(userId, dto);
  }
}
