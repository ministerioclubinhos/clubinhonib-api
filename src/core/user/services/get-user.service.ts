import { Injectable, Logger } from '@nestjs/common';
import { UserEntity } from '../entities/user.entity';
import { GetUsersQueryDto } from '../dto/get-users-query.dto';
import { UserRepository } from '../user.repository';
import { MediaItemProcessor } from 'src/shared/media/media-item-processor';
import { PersonalDataRepository } from 'src/core/profile/repositories/personal-data.repository';
import { UserPreferencesRepository } from 'src/core/profile/repositories/user-preferences.repository';
import { AppNotFoundException, ErrorCode } from 'src/shared/exceptions';
import { MyProfileResponseDto } from '../dto/my-profile-response.dto';
import { PaginatedUsersResponseDto } from '../dto/user-response.dto';
import { toMyProfileResponse, toUserResponse } from '../mappers';
import { EmailRecipient } from 'src/shared/email/types';
import { USER_MEDIA_TARGET } from '../constants';

@Injectable()
export class GetUsersService {
  private readonly logger = new Logger(GetUsersService.name);

  constructor(
    private readonly userRepo: UserRepository,
    private readonly mediaItemProcessor: MediaItemProcessor,
    private readonly personalDataRepository: PersonalDataRepository,
    private readonly userPreferencesRepository: UserPreferencesRepository,
  ) {}

  /** Página da listagem administrativa, já no contrato público. */
  async findAllPaginated(
    q: GetUsersQueryDto,
  ): Promise<PaginatedUsersResponseDto> {
    const { items, page, limit, total, totalPages, sort, order } =
      await this.userRepo.findAllPaginated(q);

    return {
      items: items.map(toUserResponse),
      meta: { page, limit, total, totalPages, sort, order },
    };
  }

  async findAlll(): Promise<UserEntity[]> {
    return this.userRepo.findAll();
  }

  async findOne(id: string): Promise<UserEntity> {
    const user = await this.userRepo.findById(id);
    if (!user) {
      throw new AppNotFoundException(
        ErrorCode.USER_NOT_FOUND,
        'Usuário não encontrado',
      );
    }
    return user;
  }

  /**
   * Destinatários dos avisos enviados a toda a base: só usuários já validados.
   * Outros módulos chegam aqui pelo serviço, nunca pelo repositório de usuário.
   */
  async findActiveRecipients(): Promise<EmailRecipient[]> {
    return this.userRepo.findActiveRecipients();
  }

  async findByEmail(email: string): Promise<UserEntity | null> {
    return this.userRepo.findByEmail(email);
  }

  /**
   * Perfil de quem está logado, no contrato único de `MyProfileResponseDto`.
   */
  async findOneForProfile(id: string): Promise<MyProfileResponseDto> {
    const user = await this.userRepo.findByIdWithProfiles(id);
    if (!user) {
      throw new AppNotFoundException(
        ErrorCode.USER_NOT_FOUND,
        'Usuário não encontrado',
      );
    }

    const [image, personalData, preferences] = await Promise.all([
      this.mediaItemProcessor.findMediaItemByTarget(id, USER_MEDIA_TARGET),
      this.personalDataRepository.findByUserId(id),
      this.userPreferencesRepository.findByUserId(id),
    ]);

    return toMyProfileResponse({ user, image, personalData, preferences });
  }
}
