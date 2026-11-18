/** Mensagem entregue ao transporte SMTP. */
export interface MailMessage {
  /** Destinatários visíveis. Opcional quando o envio é só por cópia oculta. */
  to?: string | string[];
  /**
   * Cópia oculta, usada nos avisos para toda a base: sem ela, cada pessoa
   * receberia a lista de e-mails de todas as outras.
   */
  bcc?: string | string[];
  subject: string;
  html: string;
  /** Alternativa em texto puro, exigida por clientes que não renderizam HTML. */
  text: string;
  /** Para onde a resposta do destinatário deve ir, quando diferente do remetente. */
  replyTo?: string;
}
