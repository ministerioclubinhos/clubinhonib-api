import {
  PersonalDataResponseDto,
  ProfileImageResponseDto,
  UserPreferencesResponseDto,
} from 'src/core/profile/dto/complete-profile-response.dto';

/** Clubinho no recorte que o perfil mostra. */
export class MyProfileClubDto {
  id: string;
  number: number;
  weekday: string;
  /** `HH:mm`, ou `null` quando não cadastrado. */
  time: string | null;
  isActive: boolean;
}

/** Vínculo de professor, quando existe. */
export class MyProfileTeacherDto {
  id: string;
  active: boolean;
  club: MyProfileClubDto | null;
}

/** Vínculo de coordenação, quando existe. */
export class MyProfileCoordinatorDto {
  id: string;
  active: boolean;
  clubs: MyProfileClubDto[];
}

/**
 * Contrato do perfil de quem está logado.
 *
 * É a resposta de `GET /profile`, `PATCH /profile`, `PATCH /profile/password`,
 * `PATCH /profile/image` e também de `GET /auth/me` — os cinco devolvem
 * exatamente isto, montado no mesmo lugar.
 */
export class MyProfileResponseDto {
  id: string;
  email: string;
  name: string;
  phone: string;
  cpf: string | null;
  role: string;
  active: boolean;
  completed: boolean;
  commonUser: boolean;
  createdAt: string;
  updatedAt: string;
  image: ProfileImageResponseDto | null;
  personalData?: PersonalDataResponseDto;
  preferences?: UserPreferencesResponseDto;
  teacherProfile: MyProfileTeacherDto | null;
  coordinatorProfile: MyProfileCoordinatorDto | null;
}
