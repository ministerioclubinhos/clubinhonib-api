import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { UserRepository } from '../../../user/user.repository';
import { PersonalDataRepository } from '../../repositories/personal-data.repository';
import { UserPreferencesRepository } from '../../repositories/user-preferences.repository';
import { UserRole } from '../../../auth/auth.types';
import { QueryProfilesDto } from '../../dto/query-profiles.dto';
import { PaginatedProfilesResponseDto } from '../../dto/paginated-profiles-response.dto';
import { MediaItemRepository } from 'src/shared/media/media-item-repository';
import { MediaTargetType } from 'src/shared/media/media-target-type.enum';

interface UserQueryResult {
  id: string;
  email: string;
  phone: string;
  name: string;
  role: string;
}

interface CountQueryResult {
  total: string;
}

@Injectable()
export class GetAllProfilesService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly userRepository: UserRepository,
    private readonly personalDataRepository: PersonalDataRepository,
    private readonly userPreferencesRepository: UserPreferencesRepository,
    private readonly mediaItemRepository: MediaItemRepository,
  ) {}

  async execute(
    requestingUserId: string,
    requestingUserRole: UserRole,
    queryDto: QueryProfilesDto,
  ): Promise<PaginatedProfilesResponseDto> {
    const { page = 1, limit = 10 } = queryDto;

    // Ensure page and limit are numbers
    const pageNum = Number(page) || 1;
    const limitNum = Number(limit) || 10;

    const offset = (pageNum - 1) * limitNum;

    const { users, total } = await this.getUsersWithFilters(
      requestingUserId,
      requestingUserRole,
      queryDto,
      limitNum,
      offset,
    );

    const mediaItems = await this.mediaItemRepository.findManyByTargets(
      users.map((u) => u.id),
      MediaTargetType.User,
    );
    const mediaMap = new Map(mediaItems.map((m) => [m.targetId, m]));

    const profiles = await Promise.all(
      users.map(async (user) => {
        const personalData = await this.personalDataRepository.findByUserId(
          user.id,
        );
        const preferences = await this.userPreferencesRepository.findByUserId(
          user.id,
        );

        return {
          id: user.id,
          email: user.email,
          phone: user.phone,
          name: user.name,
          role: user.role,
          image: mediaMap.get(user.id),
          personalData: personalData
            ? {
                birthDate: personalData.birthDate
                  ? personalData.birthDate instanceof Date
                    ? personalData.birthDate.toISOString().split('T')[0]
                    : String(personalData.birthDate).split('T')[0]
                  : undefined,
                gender: personalData.gender,
                gaLeaderName: personalData.gaLeaderName,
                gaLeaderContact: personalData.gaLeaderContact,
              }
            : undefined,
          preferences: preferences
            ? {
                loveLanguages: preferences.loveLanguages,
                temperaments: preferences.temperaments,
                favoriteColor: preferences.favoriteColor,
                favoriteFood: preferences.favoriteFood,
                favoriteMusic: preferences.favoriteMusic,
                whatMakesYouSmile: preferences.whatMakesYouSmile,
                skillsAndTalents: preferences.skillsAndTalents,
              }
            : undefined,
        };
      }),
    );

    const totalPages = Math.ceil(total / limit);

    return {
      items: profiles,
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

  private async getUsersWithFilters(
    requestingUserId: string,
    requestingUserRole: UserRole,
    queryDto: QueryProfilesDto,
    limit: number,
    offset: number,
  ): Promise<{ users: UserQueryResult[]; total: number }> {
    const {
      q,
      name,
      email,
      role,
      loveLanguages,
      temperaments,
      favoriteColor,
      sortBy = 'name',
      order = 'ASC',
    } = queryDto;

    let baseQuery = '';
    let countQuery = '';
    const params: (string | number)[] = [];
    const countParams: (string | number)[] = [];

    if (requestingUserRole === UserRole.ADMIN) {
      baseQuery = `
        SELECT DISTINCT u.*, pd.birthDate, up.loveLanguages, up.temperaments, up.favoriteColor
        FROM users u
        LEFT JOIN personal_data pd ON pd.userId = u.id
        LEFT JOIN user_preferences up ON up.userId = u.id
        WHERE 1=1
      `;

      countQuery = `
        SELECT COUNT(DISTINCT u.id) as total
        FROM users u
        LEFT JOIN personal_data pd ON pd.userId = u.id
        LEFT JOIN user_preferences up ON up.userId = u.id
        WHERE 1=1
      `;
    } else if (requestingUserRole === UserRole.COORDINATOR) {
      baseQuery = `
        SELECT DISTINCT u.*, pd.birthDate, up.loveLanguages, up.temperaments, up.favoriteColor
        FROM users u
        INNER JOIN teacher_profiles tp ON tp.user_id = u.id
        INNER JOIN clubs c ON c.id = tp.club_id
        INNER JOIN coordinator_profiles cp ON cp.id = c.coordinator_profile_id
        LEFT JOIN personal_data pd ON pd.userId = u.id
        LEFT JOIN user_preferences up ON up.userId = u.id
        WHERE cp.user_id = ?
      `;

      countQuery = `
        SELECT COUNT(DISTINCT u.id) as total
        FROM users u
        INNER JOIN teacher_profiles tp ON tp.user_id = u.id
        INNER JOIN clubs c ON c.id = tp.club_id
        INNER JOIN coordinator_profiles cp ON cp.id = c.coordinator_profile_id
        WHERE cp.user_id = ?
      `;

      params.push(requestingUserId);
      countParams.push(requestingUserId);
    } else {
      return { users: [], total: 0 };
    }

    if (q) {
      baseQuery += ` AND (u.name LIKE ? OR u.email LIKE ?)`;
      countQuery += ` AND (u.name LIKE ? OR u.email LIKE ?)`;
      params.push(`%${q}%`, `%${q}%`);
      countParams.push(`%${q}%`, `%${q}%`);
    }

    if (name) {
      baseQuery += ` AND u.name LIKE ?`;
      countQuery += ` AND u.name LIKE ?`;
      params.push(`%${name}%`);
      countParams.push(`%${name}%`);
    }

    if (email) {
      baseQuery += ` AND u.email LIKE ?`;
      countQuery += ` AND u.email LIKE ?`;
      params.push(`%${email}%`);
      countParams.push(`%${email}%`);
    }

    if (role) {
      baseQuery += ` AND u.role = ?`;
      countQuery += ` AND u.role = ?`;
      params.push(role);
      countParams.push(role);
    }

    if (loveLanguages) {
      baseQuery += ` AND up.loveLanguages LIKE ?`;
      countQuery += ` AND up.loveLanguages LIKE ?`;
      params.push(`%${loveLanguages}%`);
      countParams.push(`%${loveLanguages}%`);
    }

    if (temperaments) {
      baseQuery += ` AND up.temperaments LIKE ?`;
      countQuery += ` AND up.temperaments LIKE ?`;
      params.push(`%${temperaments}%`);
      countParams.push(`%${temperaments}%`);
    }

    if (favoriteColor) {
      baseQuery += ` AND up.favoriteColor LIKE ?`;
      countQuery += ` AND up.favoriteColor LIKE ?`;
      params.push(`%${favoriteColor}%`);
      countParams.push(`%${favoriteColor}%`);
    }

    const sortColumn = sortBy === 'birthDate' ? 'pd.birthDate' : `u.${sortBy}`;
    baseQuery += ` ORDER BY ${sortColumn} ${order}`;

    baseQuery += ` LIMIT ? OFFSET ?`;
    params.push(limit, offset);

    const users = await this.dataSource.query<UserQueryResult[]>(
      baseQuery,
      params,
    );
    const countResult = await this.dataSource.query<CountQueryResult[]>(
      countQuery,
      countParams,
    );
    const total = parseInt(countResult[0]?.total || '0', 10);

    return { users, total };
  }
}
