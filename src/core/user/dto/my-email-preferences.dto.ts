import { IsBoolean } from 'class-validator';

/** Corpo de `PUT /email-preferences/me`. */
export class UpdateMyEmailPreferencesDto {
  /** `true` para receber os avisos por e-mail; `false` para sair da lista. */
  @IsBoolean()
  noticesEnabled: boolean;
}

/** Preferência de e-mail da pessoa logada. */
export class MyEmailPreferencesResponseDto {
  /**
   * `true` quando a pessoa recebe os avisos por e-mail (material da semana,
   * eventos, informativos, documentos e lembretes do clubinho). E-mails de
   * conta e de segurança saem sempre, independentemente desta escolha.
   */
  noticesEnabled: boolean;
}
