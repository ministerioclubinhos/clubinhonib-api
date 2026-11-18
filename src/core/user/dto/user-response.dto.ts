import { UserRole } from 'src/core/auth/auth.types';

import { SortOrder, UserSortField } from '../constants';

/**
 * Contrato público de um usuário na administração.
 *
 * É o recorte que as rotas de `/users` devolvem. Antes elas respondiam a
 * `UserEntity` inteira, e com ela o hash da senha e o refresh token.
 */
export class UserResponseDto {
  id: string;
  name: string;
  email: string;
  phone: string;
  cpf: string | null;
  role: UserRole;
  active: boolean;
  completed: boolean;
  commonUser: boolean;
  createdAt: string;
  updatedAt: string;
}

/** Metadados da paginação da listagem de usuários. */
export class UsersPageMetaDto {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  sort: UserSortField;
  order: SortOrder;
}

/** Contrato de `GET /users`. */
export class PaginatedUsersResponseDto {
  items: UserResponseDto[];
  meta: UsersPageMetaDto;
}
