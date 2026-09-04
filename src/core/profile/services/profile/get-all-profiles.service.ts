import { Injectable } from '@nestjs/common';

import { UserRole } from 'src/core/auth/auth.types';
import { MediaItemRepository } from 'src/shared/media/media-item-repository';
import { MediaTargetType } from 'src/shared/media/media-target-type.enum';

import {
  PROFILES_DEFAULT_LIMIT,
  PROFILES_DEFAULT_PAGE,
  PROFILES_MAX_LIMIT,
} from '../../constants';
import { PaginatedProfilesResponseDto } from '../../dto/paginated-profiles-response.dto';
import { ProfileBirthdayResponseDto } from '../../dto/profile-birthday-response.dto';
import { QueryProfilesDto } from '../../dto/query-profiles.dto';
import {
  toCompleteProfileResponse,
  toProfileImageResponse,
} from '../../mappers';
import { PersonalDataRepository } from '../../repositories/personal-data.repository';
import { ProfilesListingRepository } from '../../repositories/profiles-listing.repository';
import { UserPreferencesRepository } from '../../repositories/user-preferences.repository';
import { ProfileAccessContext } from '../../types';
import { assertCanListProfiles, normalizedRole, toDateOnly } from '../../utils';

@Injectable()
export class GetAllProfilesService {
  constructor(
    private readonly listingRepository: ProfilesListingRepository,
    private readonly personalDataRepository: PersonalDataRepository,
    private readonly userPreferencesRepository: UserPreferencesRepository,
    private readonly mediaItemRepository: MediaItemRepository,
  ) {}

  async execute(
    context: ProfileAccessContext,
    query: QueryProfilesDto,
  ): Promise<PaginatedProfilesResponseDto> {
    assertCanListProfiles(context);

    const role = normalizedRole(context) as UserRole;
    const requestingUserId = context.userId ?? '';

    const page = Math.max(query.page ?? PROFILES_DEFAULT_PAGE, 1);
    const limit = Math.min(
      Math.max(query.limit ?? PROFILES_DEFAULT_LIMIT, 1),
      PROFILES_MAX_LIMIT,
    );

    const { users, total } = await this.listingRepository.findPage(
      role,
      requestingUserId,
      query,
      limit,
      (page - 1) * limit,
    );

    const userIds = users.map((user) => user.id);

    // Uma consulta por bloco, e não uma por usuário: a versão anterior fazia
    // duas idas ao banco para cada linha da página.
    const [mediaItems, personalDataRows, preferencesRows] = await Promise.all([
      this.mediaItemRepository.findManyByTargets(userIds, MediaTargetType.User),
      this.personalDataRepository.findByUserIds(userIds),
      this.userPreferencesRepository.findByUserIds(userIds),
    ]);

    const mediaByUser = new Map(
      mediaItems.map((item) => [item.targetId, item]),
    );
    const personalDataByUser = new Map(
      personalDataRows.map((row) => [row.userId, row]),
    );
    const preferencesByUser = new Map(
      preferencesRows.map((row) => [row.userId, row]),
    );

    const totalPages = Math.ceil(total / limit);

    return {
      items: users.map((user) =>
        toCompleteProfileResponse({
          user,
          image: mediaByUser.get(user.id),
          personalData: personalDataByUser.get(user.id),
          preferences: preferencesByUser.get(user.id),
        }),
      ),
      meta: {
        currentPage: page,
        itemsPerPage: limit,
        totalItems: total,
        totalPages,
        hasNextPage: page < totalPages,
        hasPreviousPage: page > 1,
      },
    };
  }

  /** Aniversariantes do mês, no recorte mínimo que a faixa da tela mostra. */
  async findBirthdaysOfCurrentMonth(
    context: ProfileAccessContext,
  ): Promise<ProfileBirthdayResponseDto[]> {
    assertCanListProfiles(context);

    const role = normalizedRole(context) as UserRole;
    const rows = await this.listingRepository.findBirthdaysOfCurrentMonth(
      role,
      context.userId ?? '',
    );

    const mediaItems = await this.mediaItemRepository.findManyByTargets(
      rows.map((row) => row.id),
      MediaTargetType.User,
    );
    const mediaByUser = new Map(
      mediaItems.map((item) => [item.targetId, item]),
    );

    return rows.map((row) => ({
      id: row.id,
      name: row.name,
      role: row.role,
      birthDate: toDateOnly(row.birthDate) ?? '',
      image: toProfileImageResponse(mediaByUser.get(row.id)),
    }));
  }
}
