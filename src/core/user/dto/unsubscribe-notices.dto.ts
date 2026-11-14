import { IsString, MaxLength, MinLength } from 'class-validator';

/** Corpo de `POST /email-preferences/unsubscribe`. */
export class UnsubscribeNoticesDto {
  /** Token assinado que veio no rodapé do e-mail. */
  @IsString()
  @MinLength(1)
  @MaxLength(512)
  token: string;
}

/** Resposta do descadastro. */
export class EmailPreferencesResponseDto {
  /** `true` quando a pessoa não recebe mais os avisos. */
  unsubscribed: boolean;
  message: string;
}
