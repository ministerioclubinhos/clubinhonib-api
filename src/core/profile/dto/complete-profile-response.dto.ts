/** Dados pessoais no contrato de resposta. */
export class PersonalDataResponseDto {
  /** `YYYY-MM-DD`, ou ausente quando não informado. */
  birthDate?: string;
  gender?: string;
  gaLeaderName?: string;
  gaLeaderContact?: string;
}

/** Preferências no contrato de resposta. */
export class UserPreferencesResponseDto {
  loveLanguages?: string;
  temperaments?: string;
  favoriteColor?: string;
  favoriteFood?: string;
  favoriteMusic?: string;
  whatMakesYouSmile?: string;
  skillsAndTalents?: string;
}

/**
 * Foto do perfil no contrato de resposta.
 *
 * É o recorte da mídia que a tela usa — antes o contrato devolvia a entidade
 * `MediaItemEntity` inteira, expondo colunas internas.
 */
export class ProfileImageResponseDto {
  id: string;
  title: string | null;
  description: string | null;
  url: string;
  uploadType: string;
  mediaType: string;
  isLocalFile: boolean;
  platformType: string | null;
  originalName: string | null;
  size: number | null;
}

/** Contrato de resposta de `/profiles`. */
export class CompleteProfileResponseDto {
  id: string;
  email: string;
  phone: string;
  name: string;
  role: string;
  image: ProfileImageResponseDto | null;
  personalData?: PersonalDataResponseDto;
  preferences?: UserPreferencesResponseDto;
}
