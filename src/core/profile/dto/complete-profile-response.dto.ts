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

export class CompleteProfileResponseDto {
  id: number | string;
  email: string;
  phone: string;
  name: string;
  role: string;
  personalData?: PersonalDataResponseDto;
  preferences?: UserPreferencesResponseDto;
}
