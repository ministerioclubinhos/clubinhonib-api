/** Porta padrão do Gmail com STARTTLS. */
export const SMTP_DEFAULT_PORT = 587;

/** Host padrão, usado quando a variável não é informada. */
export const SMTP_DEFAULT_HOST = 'smtp.gmail.com';

/** Nome exibido como remetente quando a variável não é informada. */
export const SMTP_DEFAULT_FROM_NAME = 'Clubinhos NIB';

/**
 * O Gmail só aceita enviar como a conta autenticada ou como um alias
 * verificado nela: qualquer outro remetente é reescrito no caminho.
 */
export const SMTP_FROM_MUST_MATCH_USER_HINT =
  'O Gmail reescreve o remetente quando MAIL_FROM_ADDRESS não é a conta autenticada nem um alias verificado dela.';
