/**
 * Constantes e conjuntos finitos do módulo de professores.
 */
import { UserRole } from 'src/core/auth/auth.types';

/** Paginação da listagem. */
export const TEACHERS_DEFAULT_PAGE = 1;
export const TEACHERS_DEFAULT_LIMIT = 12;
export const TEACHERS_MAX_LIMIT = 100;

/** Campo pelo qual a listagem pode ser ordenada. */
export enum TeacherSortField {
  NAME = 'name',
  CLUB_NUMBER = 'clubNumber',
  CREATED_AT = 'createdAt',
  UPDATED_AT = 'updatedAt',
}

/** Direção da ordenação. */
export enum SortOrder {
  ASC = 'asc',
  DESC = 'desc',
}

export const TEACHERS_DEFAULT_SORT = TeacherSortField.UPDATED_AT;
export const TEACHERS_DEFAULT_ORDER = SortOrder.DESC;

/**
 * Quem enxerga os professores.
 *
 * O professor não entra: a listagem traz e-mail e telefone dos colegas e do
 * coordenador de cada clubinho.
 */
export const TEACHER_READ_ROLES: readonly UserRole[] = [
  UserRole.ADMIN,
  UserRole.COORDINATOR,
];

/**
 * Coluna do banco por campo de ordenação.
 *
 * A consulta nunca interpola o valor recebido: só um destes nomes chega ao SQL.
 */
export const TEACHER_SORT_COLUMNS: Record<TeacherSortField, string> = {
  [TeacherSortField.NAME]: 'teacher_user.name',
  [TeacherSortField.CLUB_NUMBER]: 'club.number',
  [TeacherSortField.CREATED_AT]: 'teacher.createdAt',
  [TeacherSortField.UPDATED_AT]: 'teacher.updatedAt',
};
