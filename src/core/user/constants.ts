/**
 * Constantes e conjuntos finitos do módulo de usuários.
 *
 * Ficam num arquivo só para o repositório, o DTO de consulta e a documentação
 * não discordarem sobre o que a listagem aceita.
 */

/** Paginação da listagem administrativa. */
export const USERS_DEFAULT_PAGE = 1;
export const USERS_DEFAULT_LIMIT = 12;
export const USERS_MAX_LIMIT = 100;

/** Campo pelo qual a listagem de usuários pode ser ordenada. */
export enum UserSortField {
  NAME = 'name',
  EMAIL = 'email',
  PHONE = 'phone',
  ROLE = 'role',
  CREATED_AT = 'createdAt',
  UPDATED_AT = 'updatedAt',
}

/** Direção da ordenação. */
export enum SortOrder {
  ASC = 'ASC',
  DESC = 'DESC',
}

export const USER_DEFAULT_SORT = UserSortField.UPDATED_AT;
export const USER_DEFAULT_ORDER = SortOrder.DESC;

/**
 * Coluna do banco por campo de ordenação.
 *
 * A consulta nunca interpola o valor recebido: só um destes nomes chega ao SQL.
 */
export const USER_SORT_COLUMNS: Record<UserSortField, string> = {
  [UserSortField.NAME]: 'u.name',
  [UserSortField.EMAIL]: 'u.email',
  [UserSortField.PHONE]: 'u.phone',
  [UserSortField.ROLE]: 'u.role',
  [UserSortField.CREATED_AT]: 'u.createdAt',
  [UserSortField.UPDATED_AT]: 'u.updatedAt',
};

/** Custo do hash de senha. */
export const PASSWORD_SALT_ROUNDS = 10;

/** Alvo das mídias de foto de perfil, escrito e lido com o mesmo texto. */
export const USER_MEDIA_TARGET = 'UserEntity';

/** Nome do campo do form-data que carrega o arquivo da foto. */
export const USER_IMAGE_FIELD_KEY = 'file';

/**
 * Caminhos do site usados nos avisos de conta.
 *
 * Ficam aqui, e não montados na hora, para o link do e-mail e o link do painel
 * não divergirem quando a rota mudar.
 */
export const USER_EMAIL_PATHS = {
  login: 'login',
  contact: 'contato',
} as const;

/**
 * O papel em texto legível.
 *
 * O enum é inglês e o e-mail é português; sem isto a pessoa receberia "seu
 * papel mudou para coordinator".
 */
export const USER_ROLE_LABELS = {
  admin: 'Administrador',
  coordinator: 'Coordenador',
  teacher: 'Professor',
} as const;
