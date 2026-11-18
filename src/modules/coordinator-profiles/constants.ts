/**
 * Constantes e conjuntos finitos do módulo de coordenadores.
 */
import { UserRole } from 'src/core/auth/auth.types';

/** Paginação da listagem. */
export const COORDINATORS_DEFAULT_PAGE = 1;
export const COORDINATORS_DEFAULT_LIMIT = 12;
export const COORDINATORS_MAX_LIMIT = 100;

/** Campo pelo qual a listagem pode ser ordenada. */
export enum CoordinatorSortField {
  NAME = 'name',
  CREATED_AT = 'createdAt',
  UPDATED_AT = 'updatedAt',
}

/** Direção da ordenação. */
export enum SortOrder {
  ASC = 'asc',
  DESC = 'desc',
}

export const COORDINATORS_DEFAULT_SORT = CoordinatorSortField.UPDATED_AT;
export const COORDINATORS_DEFAULT_ORDER = SortOrder.DESC;

/**
 * Quem enxerga os coordenadores.
 *
 * O professor não entra: a listagem traz e-mail e telefone de coordenadores e
 * de todos os professores de cada clubinho.
 */
export const COORDINATOR_READ_ROLES: readonly UserRole[] = [
  UserRole.ADMIN,
  UserRole.COORDINATOR,
];

/**
 * Quem mexe no vínculo entre clubinho e coordenador.
 *
 * Atribuir, remover ou mover um clubinho reorganiza a estrutura inteira, então
 * é operação de administrador — antes qualquer pessoa autenticada podia fazê-la.
 */
export const COORDINATOR_MANAGE_ROLES: readonly UserRole[] = [UserRole.ADMIN];

/**
 * Coluna do banco por campo de ordenação.
 *
 * A consulta nunca interpola o valor recebido: só um destes nomes chega ao SQL.
 */
export const COORDINATOR_SORT_COLUMNS: Record<CoordinatorSortField, string> = {
  [CoordinatorSortField.NAME]: 'coord_user.name',
  [CoordinatorSortField.CREATED_AT]: 'coord.createdAt',
  [CoordinatorSortField.UPDATED_AT]: 'coord.updatedAt',
};
