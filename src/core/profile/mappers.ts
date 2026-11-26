import { MediaItemEntity } from 'src/shared/media/media-item/media-item.entity';

import {
  CompleteProfileResponseDto,
  PersonalDataResponseDto,
  ProfileImageResponseDto,
  UserPreferencesResponseDto,
} from './dto/complete-profile-response.dto';
import { PersonalData } from './entities/personal-data.entity';
import { UserPreferences } from './entities/user-preferences.entity';
import { ProfileUserSource } from './types';
import { toDateOnly } from './utils';

/**
 * Um único lugar constrói a resposta de perfil.
 *
 * Antes a mesma montagem estava copiada em cinco serviços, e elas já haviam
 * divergido: a edição devolvia o perfil sem a foto que a leitura devolvia.
 */

/** Foto do perfil, ou `null` quando não há. */
export function toProfileImageResponse(
  media?: MediaItemEntity | null,
): ProfileImageResponseDto | null {
  if (!media) return null;

  return {
    id: media.id,
    title: media.title ?? null,
    description: media.description ?? null,
    url: media.url,
    uploadType: media.uploadType,
    mediaType: media.mediaType,
    isLocalFile: media.isLocalFile,
    platformType: media.platformType ?? null,
    originalName: media.originalName ?? null,
    size: media.size ?? null,
  };
}

/** Dados pessoais, ou `undefined` quando o usuário ainda não preencheu. */
export function toPersonalDataResponse(
  personalData?: PersonalData | null,
): PersonalDataResponseDto | undefined {
  if (!personalData) return undefined;

  return {
    birthDate: toDateOnly(personalData.birthDate),
    gender: personalData.gender,
    gaLeaderName: personalData.gaLeaderName,
    gaLeaderContact: personalData.gaLeaderContact,
  };
}

/** Preferências, ou `undefined` quando o usuário ainda não preencheu. */
export function toPreferencesResponse(
  preferences?: UserPreferences | null,
): UserPreferencesResponseDto | undefined {
  if (!preferences) return undefined;

  return {
    loveLanguages: preferences.loveLanguages,
    temperaments: preferences.temperaments,
    favoriteColor: preferences.favoriteColor,
    favoriteFood: preferences.favoriteFood,
    favoriteMusic: preferences.favoriteMusic,
    whatMakesYouSmile: preferences.whatMakesYouSmile,
    skillsAndTalents: preferences.skillsAndTalents,
  };
}

/** Perfil completo: conta, foto, dados pessoais e preferências. */
export function toCompleteProfileResponse(args: {
  user: ProfileUserSource;
  image?: MediaItemEntity | null;
  personalData?: PersonalData | null;
  preferences?: UserPreferences | null;
}): CompleteProfileResponseDto {
  const { user, image, personalData, preferences } = args;

  return {
    id: user.id,
    email: user.email,
    phone: user.phone,
    name: user.name,
    role: user.role,
    image: toProfileImageResponse(image),
    personalData: toPersonalDataResponse(personalData),
    preferences: toPreferencesResponse(preferences),
  };
}
