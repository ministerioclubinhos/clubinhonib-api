import { UserRole } from './auth.types';

/** Todos os papéis conhecidos, para reconhecer o que vem do token. */
const PAPEIS_CONHECIDOS = new Set<string>(Object.values(UserRole));

/**
 * Converte o papel que veio no token em `UserRole`.
 *
 * Existe uma vez só porque a mesma função estava copiada em `clubs`, `pagelas`
 * e `profile`, e as três devolviam `string`. Com `string`, comparar com
 * `'coordinaton'` compila e libera o acesso em silêncio: o `eslint` não acusa e
 * o teste só pega se alguém tiver pensado naquele caso.
 *
 * Papel desconhecido — ou ausente — vira `undefined`, e não texto vazio: quem
 * decide o que fazer com isso é a regra de permissão, que nunca deve tratar
 * "não sei quem é" como um papel válido.
 */
export function normalizeRole(role?: string | null): UserRole | undefined {
  const normalizado = role?.trim().toLowerCase();

  return normalizado && PAPEIS_CONHECIDOS.has(normalizado)
    ? (normalizado as UserRole)
    : undefined;
}
