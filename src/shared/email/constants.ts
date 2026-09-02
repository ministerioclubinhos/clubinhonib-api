/**
 * Paleta da marca usada por todos os e-mails.
 *
 * O verde e o vermelho são cores de marca fortes: entram como acento — faixa
 * do cabeçalho, filete da citação, fundo do botão — e não como contorno de
 * cada campo. Rótulos e separadores usam os tons neutros.
 */
export const EMAIL_COLORS = {
  bodyBackground: '#F4F6F8',
  brandGreen: '#56FE58',
  cardBackground: '#FFFFFF',
  primaryText: '#2F3290',
  accent: '#EB1E26',
  /** Rótulos e textos de apoio. */
  mutedText: '#6B7280',
  /** Separadores e contornos discretos. */
  border: '#E6E8EC',
  /** Fundo dos blocos destacados. */
  surface: '#F7F8FA',
  /** Texto sobre a faixa escura do cabeçalho. */
  onDark: '#FFFFFF',
} as const;

/** Textos fixos do cabeçalho e do rodapé. */
export const EMAIL_BRAND = {
  name: 'Clubinhos NIB',
  tagline: 'Conectando Crianças através da fé',
} as const;

/** Assunto de cada e-mail, em um lugar só. */
export const EMAIL_SUBJECTS = {
  passwordRecovery: 'Recuperação de senha - Clubinhos NIB',
  passwordChanged: 'Senha alterada com sucesso - Clubinhos NIB',
  emailVerification: 'Confirme seu e-mail - Clubinhos NIB',
  contactNotification: 'Novo contato pelo site',
  commentNotification: 'Novo comentário enviado na Área do Professor',
  siteFeedbackNotification: 'Nova avaliação do site',
  ideaSharedNotification: 'Nova ideia compartilhada pelo site',
  imageSharedNotification: 'Novas imagens compartilhadas do Clubinho',
  newUserRegistrationNotification: 'Novo pré-cadastro de usuário no site',
  weekMaterialAnnouncement: 'Novo material da semana já disponível',
  eventCreated: 'Novo evento na agenda do Clubinho',
  eventUpdated: 'Um evento da agenda mudou',
  eventCancelled: 'Um evento saiu da agenda',
} as const;

/** Validade dos links enviados, em minutos. */
export const EMAIL_LINK_TTL_MINUTES = {
  passwordRecovery: 30,
  emailVerification: 60 * 24,
} as const;

/** Largura máxima do cartão, o padrão seguro para clientes de e-mail. */
export const EMAIL_MAX_WIDTH_PX = 600;

/**
 * Quantos endereços entram em cada envio de um aviso para toda a base.
 *
 * O aviso vai por cópia oculta em lotes: o Gmail limita destinatários por
 * mensagem e por dia, e um lote menor também reduz o estrago quando um envio
 * falha no meio.
 */
export const EMAIL_ANNOUNCEMENT_BATCH_SIZE = 50;

/** Esquemas aceitos em um link dentro do e-mail. */
export const EMAIL_ALLOWED_URL_SCHEMES = ['http:', 'https:'] as const;
