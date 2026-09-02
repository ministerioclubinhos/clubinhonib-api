/** Bytes sorteados para os tokens enviados por e-mail. */
export const AUTH_TOKEN_BYTES = 32;

/** Validade do link de confirmação de e-mail, em horas. */
export const EMAIL_VERIFICATION_TTL_HOURS = 24;

/**
 * Intervalo mínimo entre dois envios de confirmação para o mesmo usuário.
 * Sem ele, cada tentativa de login de uma conta inativa dispararia um e-mail.
 */
export const EMAIL_VERIFICATION_RESEND_COOLDOWN_MINUTES = 5;

/** Validade do link de recuperação de senha, em minutos. */
export const PASSWORD_RESET_TTL_MINUTES = 30;

/** Mensagens devolvidas no bloco `emailVerification` das respostas de auth. */
export const EMAIL_VERIFICATION_MESSAGES = {
  sent: 'Enviamos um e-mail de confirmação para o seu endereço. Verifique sua caixa de entrada.',
  alreadySent:
    'Um e-mail de confirmação já foi enviado há pouco. Verifique sua caixa de entrada e o spam.',
  verified: 'E-mail já confirmado.',
} as const;

/** Caminhos do site usados nos links enviados por e-mail. */
export const AUTH_EMAIL_PATHS = {
  passwordReset: 'recuperar-senha',
  emailVerification: 'confirmar-email',
} as const;
