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

/**
 * Validade do link que a coordenação envia junto com uma conta recém-criada,
 * em horas.
 *
 * Bem mais longo que os 30 minutos da recuperação, e de propósito: ninguém
 * pediu esse e-mail, então ele chega quando chega — no meio de uma reunião, no
 * fim do dia — e um link que morre antes de a pessoa abrir a caixa de entrada
 * só gera um pedido de "esqueci minha senha" no dia seguinte.
 */
export const PASSWORD_SETUP_TTL_HOURS = 48;

/** Mensagens devolvidas no bloco `emailVerification` das respostas de auth. */
export const EMAIL_VERIFICATION_MESSAGES = {
  sent: 'Enviamos um e-mail de confirmação para o seu endereço. Verifique sua caixa de entrada.',
  alreadySent:
    'Um e-mail de confirmação já foi enviado há pouco. Verifique sua caixa de entrada e o spam.',
  verified: 'E-mail já confirmado.',
  /**
   * O envio falhou, mas a conta existe e o link está válido.
   *
   * O texto pede a reenvio em vez de sugerir que a conta ficou pela metade:
   * quem lê isto acabou de se cadastrar ou de entrar, e o cadastro deu certo.
   */
  failed:
    'Não conseguimos enviar o e-mail de confirmação agora. Você pode pedir o reenvio em instantes.',
} as const;

/** Caminhos do site usados nos links enviados por e-mail. */
export const AUTH_EMAIL_PATHS = {
  passwordReset: 'recuperar-senha',
  emailVerification: 'confirmar-email',
} as const;
