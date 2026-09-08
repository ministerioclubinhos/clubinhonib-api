/**
 * As chaves das flags de fábrica.
 *
 * Uma chave por recurso: o perfil que enxerga cada um vem de `targetRoles`, e
 * não do nome.
 */
export enum FeatureFlagKeys {
  CHILDREN_AREA = 'children_area',
  CLUB_PHOTO_UPLOAD = 'club_photo_upload',
  WEEKLY_MATERIALS = 'weekly_materials',
  SITE_FEEDBACK = 'site_feedback',
  IDEA_SUBMISSION = 'idea_submission',
  IDEAS_SHARING = 'ideas_sharing',
  EVENTS_SECTION = 'events_section',
  CLUBINHO_FEED = 'clubinho_feed',
  STATISTICS = 'statistics',
  CLUB_CONTROL = 'club_control',
  /**
   * O resumo semanal dos clubinhos, no painel.
   *
   * Não confundir com `EMAIL_WEEKLY_CLUB_SUMMARY`: aquela liga o envio do
   * e-mail de segunda-feira, esta liga a tela que o e-mail abre. São
   * decisões diferentes — parar de mandar o aviso não deve trancar quem
   * quiser consultar o histórico.
   */
  CLUB_WEEKLY_SUMMARY = 'club_weekly_summary',
  PAGELAS = 'pagelas',

  /**
   * Uma chave por e-mail que a aplicação dispara.
   *
   * Toda notificação por e-mail fica atrás de uma flag própria, e nunca
   * compartilha a flag do recurso que a origina: desligar o formulário de
   * contato e parar de avisar a equipe sobre os contatos que já chegaram são
   * decisões diferentes, e um interruptor só não sabe distinguir as duas.
   *
   * O prefixo `email_` mantém todas juntas na listagem, que é ordenada por
   * chave.
   */
  EMAIL_PASSWORD_RECOVERY = 'email_password_recovery',
  EMAIL_PASSWORD_CHANGED = 'email_password_changed',
  EMAIL_VERIFICATION = 'email_verification',
  EMAIL_CONTACT_NOTIFICATION = 'email_contact_notification',
  EMAIL_COMMENT_NOTIFICATION = 'email_comment_notification',
  EMAIL_SITE_FEEDBACK_NOTIFICATION = 'email_site_feedback_notification',
  EMAIL_IDEA_SHARED_NOTIFICATION = 'email_idea_shared_notification',
  EMAIL_IMAGE_SHARED_NOTIFICATION = 'email_image_shared_notification',
  EMAIL_NEW_USER_REGISTRATION = 'email_new_user_registration',
  EMAIL_WEEK_MATERIAL_ANNOUNCEMENT = 'email_week_material_announcement',
  EMAIL_EVENT_CREATED = 'email_event_created',
  EMAIL_EVENT_UPDATED = 'email_event_updated',
  EMAIL_EVENT_CANCELLED = 'email_event_cancelled',
  EMAIL_ADDRESS_CHANGED = 'email_address_changed',
  EMAIL_ACCOUNT_APPROVED = 'email_account_approved',
  EMAIL_ROLE_CHANGED = 'email_role_changed',
  EMAIL_ACCOUNT_DEACTIVATED = 'email_account_deactivated',
  EMAIL_ACCOUNT_DELETED = 'email_account_deleted',
  EMAIL_ACCOUNT_CREATED = 'email_account_created',
  EMAIL_INFORMATIVE_PUBLISHED = 'email_informative_published',
  EMAIL_DOCUMENT_PUBLISHED = 'email_document_published',
  EMAIL_CLUB_DAY_CANCELLED = 'email_club_day_cancelled',
  EMAIL_CONTACT_RECEIPT = 'email_contact_receipt',
  EMAIL_MISSING_PAGELA_REMINDER = 'email_missing_pagela_reminder',
  /**
   * O resumo semanal dos clubinhos.
   *
   * A chave não diz "coordinator", ainda que só o coordenador receba: perfil
   * não entra em nome de chave, e o nome descreve o conteúdo.
   */
  EMAIL_WEEKLY_CLUB_SUMMARY = 'email_weekly_club_summary',
  EMAIL_ACCEPTED_CHRIST = 'email_accepted_christ',
}
