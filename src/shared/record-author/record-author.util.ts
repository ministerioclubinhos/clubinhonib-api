import { UserEntity } from 'src/core/user/entities/user.entity';

import { RecordAuthorDto } from './record-author.dto';

/** Colunas do usuário que entram em uma consulta de autoria. */
export const RECORD_AUTHOR_FIELDS = ['id', 'name'] as const;

/** Colunas de autoria a selecionar para um alias de junção. */
export function recordAuthorSelection(alias: string): string[] {
  return RECORD_AUTHOR_FIELDS.map((field) => `${alias}.${field}`);
}

/**
 * Autor no contrato de resposta.
 *
 * `null` é um estado normal: registros anteriores a esta coluna não têm autor,
 * e o usuário que gravou pode ter sido excluído depois.
 */
export function toRecordAuthor(
  user: Pick<UserEntity, 'id' | 'name'> | null | undefined,
): RecordAuthorDto | null {
  return user ? { id: user.id, name: user.name } : null;
}

/**
 * Referência ao usuário para gravar a autoria só pelo id.
 *
 * Quem chega sem usuário identificado (um job, por exemplo) grava `null`.
 */
export function recordAuthorRef(
  userId: string | null | undefined,
): UserEntity | null {
  return userId ? ({ id: userId } as UserEntity) : null;
}
