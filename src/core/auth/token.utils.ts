import { createHash } from 'node:crypto';

/**
 * SHA-256 de um token enviado por e-mail. Só o hash é gravado: um vazamento do
 * banco não entrega nenhum link utilizável.
 */
export const hashAuthToken = (token: string): string =>
  createHash('sha256').update(token).digest('hex');
