/** Situação de um vídeo enviado ao Clubinho Play. */
export enum PlaySubmissionStatus {
  /** Aguardando a decisão de um administrador. */
  PENDING = 'pending',
  /** Publicado no Play numa galeria. */
  APPROVED = 'approved',
  /** Recusado pelo administrador (com motivo opcional). */
  REJECTED = 'rejected',
}
