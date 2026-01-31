export class PersonalDataResponseDto {
  birthDate?: string;
  gender?: string;
  gaLeaderName?: string;
  gaLeaderContact?: string;
}

export class UserPreferencesResponseDto {
  loveLanguages?: string;
  temperaments?: string;
  favoriteColor?: string;
  favoriteFood?: string;
  favoriteMusic?: string;
  whatMakesYouSmile?: string;
  skillsAndTalents?: string;
}

import { MediaItemEntity } from '../../../shared/media/media-item/media-item.entity';

export class CompleteProfileResponseDto {
  id: number | string;
  email: string;
  phone: string;
  name: string;
  role: string;
  image?: MediaItemEntity;
  personalData?: PersonalDataResponseDto;
  preferences?: UserPreferencesResponseDto;
}
