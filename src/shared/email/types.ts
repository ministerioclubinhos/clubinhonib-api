/**
 * Cada e-mail que a aplicação sabe disparar.
 *
 * É a lista que amarra template, método de envio e feature flag: um e-mail novo
 * entra aqui primeiro, e as três pontas passam a cobrá-lo.
 */
export enum EmailNotification {
  PasswordRecovery = 'password-recovery',
  PasswordChanged = 'password-changed',
  EmailVerification = 'email-verification',
  ContactNotification = 'contact-notification',
  CommentNotification = 'comment-notification',
  FeedPhotoCommentRejected = 'feed-photo-comment-rejected',
  SiteFeedbackNotification = 'site-feedback-notification',
  IdeaSharedNotification = 'idea-shared-notification',
  ImageSharedNotification = 'image-shared-notification',
  NewUserRegistrationNotification = 'new-user-registration-notification',
  WeekMaterialAnnouncement = 'week-material-announcement',
  EventCreated = 'event-created',
  EventUpdated = 'event-updated',
  EventCancelled = 'event-cancelled',

  /* Conta e acesso — respostas a algo que mexeu na conta da pessoa. */
  EmailAddressChanged = 'email-address-changed',
  AccountApproved = 'account-approved',
  RoleChanged = 'role-changed',
  AccountDeactivated = 'account-deactivated',
  AccountDeleted = 'account-deleted',
  AccountCreatedByAdmin = 'account-created-by-admin',

  /* Publicações que vão para toda a base. */
  InformativePublished = 'informative-published',
  DocumentPublished = 'document-published',
  ClubDayCancelled = 'club-day-cancelled',

  /* Confirmação para quem escreveu pelo site. */
  ContactReceipt = 'contact-receipt',

  /* Operacional do clubinho. */
  MissingPagelaReminder = 'missing-pagela-reminder',
  CoordinatorWeeklySummary = 'coordinator-weekly-summary',
  AcceptedChristRegistered = 'accepted-christ-registered',
}

/**
 * Quem recebe um e-mail nominal.
 *
 * O id entra porque o rodapé leva um link de descadastro assinado para aquela
 * pessoa: sem saber de quem é o endereço, não há token a emitir.
 */
export interface EmailRecipient {
  id: string;
  name: string;
  email: string;
  /**
   * Situação da conta de quem vai receber.
   *
   * Preenchido por `toEmailRecipient`, o único caminho de usuário para
   * destinatário. Ausente nas listas que já vêm filtradas pela régua do
   * `core/user` — ali não há inativo a barrar.
   *
   * `false` faz o envio ser recusado, exceto nas notificações declaradas em
   * `EMAIL_NOTIFICATIONS_FOR_INACTIVE`.
   */
  active?: boolean;
}

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
  /** Link do rodapé que cancela os avisos; some quando ausente. */
  unsubscribeUrl?: string;
}

/** Dados do e-mail de confirmação de senha alterada. */
export interface PasswordChangedEmailData {
  recipientName: string;
  loginLink: string;
  /** Link do rodapé que cancela os avisos; some quando ausente. */
  unsubscribeUrl?: string;
}

/** Dados do e-mail de confirmação de endereço. */
export interface EmailVerificationEmailData {
  recipientName: string;
  verificationLink: string;
  /** Link do rodapé que cancela os avisos; some quando ausente. */
  unsubscribeUrl?: string;
}

/** Dados do aviso de novo contato recebido pelo site. */
export interface ContactNotificationEmailData {
  name: string;
  email: string;
  phone: string;
  message: string;
  receivedAt: Date;
  /** Tela onde a mensagem é respondida; o botão some sem ela. */
  panelUrl?: string;
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
  /** Tela onde o comentário é publicado; o botão some sem ela. */
  panelUrl?: string;
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
  /** Tela onde a avaliação é lida; o botão some sem ela. */
  panelUrl?: string;
}

/** Dados do aviso de novo material da semana. */
export interface WeekMaterialAnnouncementEmailData {
  title: string;
  subtitle?: string;
  description?: string;
  materialLink: string;
  /** Material Especial: muda só o título e o assunto do mesmo aviso. */
  special?: boolean;
  /** Link do rodapé que cancela os avisos; some quando ausente. */
  unsubscribeUrl?: string;
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
  /** Link do rodapé que cancela os avisos; some quando ausente. */
  unsubscribeUrl?: string;
}

/** Resultado de um envio em lote para toda a base. */
export interface BulkEmailResult {
  recipients: number;
  /** Mensagens entregues ao transporte, uma por pessoa. */
  sent: number;
  failed: number;
}

/* ------------------------------------------------------------------ *
 * Conta e acesso
 * ------------------------------------------------------------------ */

/** Dados do aviso de que o endereço de login mudou. Vai para o antigo. */
export interface EmailAddressChangedEmailData {
  recipientName: string;
  /** O endereço novo, para a pessoa reconhecer — ou estranhar — a troca. */
  newEmail: string;
  changedAt: Date;
  /** Onde pedir socorro se não foi a pessoa quem trocou. */
  supportUrl?: string;
}

/** Dados do aviso de que o pré-cadastro foi liberado. */
export interface AccountApprovedEmailData {
  recipientName: string;
  loginLink: string;
  unsubscribeUrl?: string;
}

/** Dados do aviso de mudança de papel. */
export interface RoleChangedEmailData {
  recipientName: string;
  /** Papel em texto legível, já traduzido. */
  previousRole: string;
  currentRole: string;
  loginLink: string;
  unsubscribeUrl?: string;
}

/** Dados do aviso de conta desativada. */
export interface AccountDeactivatedEmailData {
  recipientName: string;
  unsubscribeUrl?: string;
}

/** Dados do aviso de conta excluída. */
export interface AccountDeletedEmailData {
  recipientName: string;
}

/** Dados das boas-vindas de uma conta criada pela coordenação. */
export interface AccountCreatedByAdminEmailData {
  recipientName: string;
  /** Papel em texto legível. */
  role: string;
  /** Link com token para a pessoa definir a própria senha. */
  passwordSetupLink: string;
  /** Quanto tempo o link acima vale, em horas. */
  validityHours: number;
  unsubscribeUrl?: string;
}

/* ------------------------------------------------------------------ *
 * Publicações para toda a base
 * ------------------------------------------------------------------ */

/** Dados do aviso de informativo publicado. */
export interface InformativePublishedEmailData {
  title: string;
  description?: string;
  informativeLink: string;
  unsubscribeUrl?: string;
}

/** Dados do aviso de documento novo. */
export interface DocumentPublishedEmailData {
  name: string;
  description?: string;
  documentLink: string;
  unsubscribeUrl?: string;
}

/** Dados do aviso de que uma data não terá Clubinho. */
export interface ClubDayCancelledEmailData {
  /** Data em `YYYY-MM-DD`; o template formata. */
  date: string;
  reason: string;
  /** Observação da coordenação, quando existe. */
  notes?: string;
  /** Vale todo ano na mesma data. */
  isRecurrent: boolean;
  unsubscribeUrl?: string;
}

/* ------------------------------------------------------------------ *
 * Confirmação para quem escreveu
 * ------------------------------------------------------------------ */

/** Dados da confirmação de contato recebido, enviada a quem escreveu. */
export interface ContactReceiptEmailData {
  name: string;
  /** A mensagem de volta, para a pessoa saber o que chegou. */
  message: string;
  receivedAt: Date;
}

/* ------------------------------------------------------------------ *
 * Operacional do clubinho
 * ------------------------------------------------------------------ */

/** Uma criança que ficou sem pagela na semana. */
export interface MissingChildSummary {
  childId: string;
  childName: string;
}

/** Dados do lembrete de pagela faltando em um clubinho. */
export interface MissingPagelaReminderEmailData {
  clubNumber: number;
  /** Semana letiva que fechou. */
  academicWeek: number;
  academicYear: number;
  /** Data em que o clubinho deveria ter acontecido, em `YYYY-MM-DD`. */
  expectedDate: string | null;
  totalChildren: number;
  withPagela: number;
  missing: MissingChildSummary[];
  pagelasLink: string;
  unsubscribeUrl?: string;
}

/** A linha de um clubinho no resumo do coordenador. */
export interface CoordinatorSummaryClub {
  clubNumber: number;
  /** Status já em texto legível. */
  status: string;
  totalChildren: number;
  withPagela: number;
  missing: number;
}

/** Dados do resumo semanal de um coordenador. */
export interface CoordinatorWeeklySummaryEmailData {
  recipientName: string;
  academicWeek: number;
  academicYear: number;
  clubs: CoordinatorSummaryClub[];
  /** Quantos clubinhos fecharam a semana sem pendência. */
  clubsOk: number;
  panelLink: string;
  unsubscribeUrl?: string;
}

/** Dados do aviso de decisão por Cristo registrada. */
export interface AcceptedChristRegisteredEmailData {
  childName: string;
  clubNumber: number;
  /** Decisão já em texto legível. */
  decision: string;
  registeredAt: Date;
  panelLink?: string;
  unsubscribeUrl?: string;
}

export interface FeedPhotoCommentRejectedEmailData {
  recipientName: string;
  commentText: string;
  reason: string;
  feedLink: string;
  unsubscribeUrl?: string;
}
