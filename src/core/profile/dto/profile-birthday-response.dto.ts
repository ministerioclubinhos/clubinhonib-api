import { ProfileImageResponseDto } from './complete-profile-response.dto';

/**
 * Aniversariante na faixa da tela de perfis.
 *
 * É o recorte mínimo que a faixa mostra: nem contato, nem preferências, nem
 * dados pessoais além do dia do aniversário.
 */
export class ProfileBirthdayResponseDto {
  id: string;
  name: string;
  role: string;
  /** `YYYY-MM-DD`. */
  birthDate: string;
  image: ProfileImageResponseDto | null;
}
