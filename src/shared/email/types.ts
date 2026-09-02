/**
 * Conteúdo pronto de um e-mail. Todo template devolve este formato, e é o
 * único formato que o serviço de e-mail entrega ao transporte.
 */
export interface EmailContent {
  subject: string;
  html: string;
  /** Alternativa em texto puro, obrigatória: clientes sem HTML só veem esta. */
  text: string;
}

/** Dados do e-mail de recuperação de senha. */
export interface PasswordRecoveryEmailData {
  recipientName: string;
  resetLink: string;
}

/** Dados do e-mail de confirmação de senha alterada. */
export interface PasswordChangedEmailData {
  recipientName: string;
  loginLink: string;
}

/** Dados do e-mail de confirmação de endereço. */
export interface EmailVerificationEmailData {
  recipientName: string;
  verificationLink: string;
}

/** Dados do aviso de novo contato recebido pelo site. */
export interface ContactNotificationEmailData {
  name: string;
  email: string;
  phone: string;
  message: string;
  receivedAt: Date;
}

/** Dados do aviso de nova ideia compartilhada no site. */
export interface IdeaSharedNotificationEmailData {
  title: string;
  description?: string;
  authorName?: string;
  authorEmail?: string;
  sharedAt: Date;
}

/** Dados do aviso de novas imagens compartilhadas do Clubinho no site. */
export interface ImageSharedNotificationEmailData {
  caption: string;
  description?: string;
  authorName?: string;
  authorEmail?: string;
  sharedAt: Date;
}

/** Dados do aviso de novo pré-cadastro de usuário no site. */
export interface NewUserRegistrationNotificationEmailData {
  name: string;
  email: string;
  provider: 'google' | 'normal';
  registeredAt: Date;
}

/** Dados do aviso de novo comentário na Área do Professor. */
export interface CommentNotificationEmailData {
  name: string;
  comment: string;
  clubinho: string;
  neighborhood: string;
  createdAt: Date;
}

/** Dados do aviso de uma nova avaliação do site. */
export interface SiteFeedbackNotificationEmailData {
  name: string;
  email?: string;
  /** Nota dada pela pessoa. */
  rating: number;
  /** Nota máxima possível, para exibir "4 de 5". */
  maxRating: number;
  /** Categoria já em texto legível. */
  category: string;
  comment: string;
  receivedAt: Date;
}

/** Dados do aviso de novo material da semana. */
export interface WeekMaterialAnnouncementEmailData {
  title: string;
  subtitle?: string;
  description?: string;
  materialLink: string;
}

/**
 * Dados de um evento da agenda. `date` chega como string quando vem de uma
 * coluna `date` do MySQL, e como `Date` quando é montado em memória.
 */
export interface EventAnnouncementEmailData {
  title: string;
  date: Date | string;
  location: string;
  description?: string;
  agendaLink: string;
}

/** Resultado de um envio em lote para toda a base. */
export interface BulkEmailResult {
  recipients: number;
  batchesSent: number;
  batchesFailed: number;
}
