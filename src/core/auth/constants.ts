import { UserRole } from './auth.types';

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

/**
 * Papéis que alguém pode escolher ao se cadastrar sozinho. Administrador só é
 * concedido por outro administrador, no painel: o cadastro é público, e a
 * confirmação do e-mail ativa a conta sem passar por ninguém.
 */
export const SELF_REGISTRATION_ROLES: readonly UserRole[] = [
  UserRole.TEACHER,
  UserRole.COORDINATOR,
];

export const SELF_REGISTRATION_ROLE_MESSAGE =
  'Escolha o perfil Professor ou Coordenador.';

/** Validade do comprovante que autoriza completar o cadastro do Google. */
export const REGISTRATION_TOKEN_EXPIRES_IN = '30m';

/**
 * Sufixo da chave do comprovante de cadastro. A chave própria impede que ele
 * seja aceito como token de acesso pelo guard.
 */
export const REGISTRATION_TOKEN_SECRET_SUFFIX = ':complete-registration';

export const REGISTRATION_TOKEN_INVALID_MESSAGE =
  'Sua sessão de cadastro expirou. Entre com o Google novamente.';
