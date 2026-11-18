/** Contrato de resposta de `GET /profiles/summary`. */
export class ProfileSummaryResponseDto {
  total: number;
  admins: number;
  coordinators: number;
  teachers: number;
  birthdaysThisMonth: number;
  /** Perfis sem data de nascimento ou sem preferências. */
  incomplete: number;
}
