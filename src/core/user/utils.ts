import { UserRole } from 'src/core/auth/auth.types';
import { EmailRecipient } from 'src/shared/email';

import { USER_ROLE_LABELS } from './constants';
import { UserEntity } from './entities/user.entity';

/**
 * O papel em português, para o corpo do e-mail.
 *
 * Um papel desconhecido devolve o próprio valor em vez de quebrar: um aviso com
 * a palavra errada ainda avisa; um aviso que não sai, não.
 */
export function roleLabel(role: UserRole | string): string {
  const key = String(role).toLowerCase().trim();
  return (USER_ROLE_LABELS as Record<string, string>)[key] ?? String(role);
}

/**
 * O recorte do usuário que o e-mail precisa.
 *
 * O `id` entra porque o rodapé leva um link de descadastro assinado para aquela
 * pessoa — é o mesmo contrato de `findActiveRecipients`.
 */
export function toEmailRecipient(user: UserEntity): EmailRecipient {
  return { id: user.id, name: user.name, email: user.email };
}
