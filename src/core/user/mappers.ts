import { MediaItemEntity } from 'src/shared/media/media-item/media-item.entity';
import { PersonalData } from 'src/core/profile/entities/personal-data.entity';
import { UserPreferences } from 'src/core/profile/entities/user-preferences.entity';
import {
  toPersonalDataResponse,
  toPreferencesResponse,
  toProfileImageResponse,
} from 'src/core/profile/mappers';
import { ClubEntity } from 'src/modules/clubs/entities/club.entity';

import { UserEntity } from './entities/user.entity';
import {
  MyProfileClubDto,
  MyProfileCoordinatorDto,
  MyProfileResponseDto,
  MyProfileTeacherDto,
} from './dto/my-profile-response.dto';

/** Carimbo de data em ISO, venha ele como `Date` ou já como texto. */
function toIsoString(value: Date | string): string {
  return value instanceof Date ? value.toISOString() : String(value);
}

function toClub(club: ClubEntity): MyProfileClubDto {
  return {
    id: club.id,
    number: club.number,
    weekday: club.weekday,
    time: club.time ?? null,
    isActive: club.isActive,
  };
}

function toTeacherProfile(user: UserEntity): MyProfileTeacherDto | null {
  const teacher = user.teacherProfile;
  if (!teacher) return null;

  return {
    id: teacher.id,
    active: teacher.active,
    club: teacher.club ? toClub(teacher.club) : null,
  };
}

function toCoordinatorProfile(
  user: UserEntity,
): MyProfileCoordinatorDto | null {
  const coordinator = user.coordinatorProfile;
  if (!coordinator) return null;

  return {
    id: coordinator.id,
    active: coordinator.active,
    clubs: (coordinator.clubs ?? []).map(toClub),
  };
}

/**
 * Monta o perfil de quem está logado.
 *
 * Um único lugar constrói esta resposta. Antes `GET /profile` e `GET /auth/me`
 * tinham cada um a sua cópia, e elas já haviam divergido: `/auth/me` não
 * mandava `active`, `completed`, `createdAt` nem `updatedAt`, campos que a tela
 * de perfil exibe.
 */
export function toMyProfileResponse(args: {
  user: UserEntity;
  image?: MediaItemEntity | null;
  personalData?: PersonalData | null;
  preferences?: UserPreferences | null;
}): MyProfileResponseDto {
  const { user, image, personalData, preferences } = args;

  return {
    id: user.id,
    email: user.email,
    name: user.name,
    phone: user.phone,
    cpf: user.cpf ?? null,
    role: user.role,
    active: user.active,
    completed: user.completed,
    commonUser: user.commonUser,
    createdAt: toIsoString(user.createdAt),
    updatedAt: toIsoString(user.updatedAt),
    image: toProfileImageResponse(image),
    personalData: toPersonalDataResponse(personalData),
    preferences: toPreferencesResponse(preferences),
    teacherProfile: toTeacherProfile(user),
    coordinatorProfile: toCoordinatorProfile(user),
  };
}
