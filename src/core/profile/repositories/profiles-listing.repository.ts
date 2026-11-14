import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';

import { UserRole } from 'src/core/auth/auth.types';

import {
  PROFILE_BIRTHDAY_MAX_RESULTS,
  PROFILE_SORT_COLUMNS,
  PROFILE_DEFAULT_ORDER,
  PROFILE_DEFAULT_SORT,
  ProfileSortField,
  ProfileSortOrder,
} from '../constants';
import { QueryProfilesDto } from '../dto/query-profiles.dto';
import { ProfileBirthdayRow, ProfileUserSource } from '../types';

interface CountRow {
  total: string | number;
}

/**
 * Consultas da listagem de perfis.
 *
 * O SQL vive aqui, e não no caso de uso: antes o serviço montava e executava a
 * consulta direto no `DataSource`.
 */
@Injectable()
export class ProfilesListingRepository {
  constructor(private readonly dataSource: DataSource) {}

  /**
   * Recorte que cada papel enxerga.
   *
   * O administrador vê todo mundo; o coordenador, só os professores dos seus
   * clubinhos. Qualquer outro papel não chega aqui — o caso de uso barra antes.
   */
  private scopeClause(role: UserRole): { from: string; where: string } {
    if (role === UserRole.COORDINATOR) {
      return {
        from: `
          FROM users u
          INNER JOIN teacher_profiles tp ON tp.user_id = u.id
          INNER JOIN clubs c ON c.id = tp.club_id
          INNER JOIN coordinator_profiles cp ON cp.id = c.coordinator_profile_id
          LEFT JOIN personal_data pd ON pd.userId = u.id
          LEFT JOIN user_preferences up ON up.userId = u.id
        `,
        where: 'WHERE cp.user_id = ?',
      };
    }

    return {
      from: `
        FROM users u
        LEFT JOIN personal_data pd ON pd.userId = u.id
        LEFT JOIN user_preferences up ON up.userId = u.id
      `,
      where: 'WHERE 1 = 1',
    };
  }

  /** Filtros de texto e de papel, com os valores sempre parametrizados. */
  private filterClause(query: QueryProfilesDto): {
    sql: string;
    params: string[];
  } {
    const conditions: string[] = [];
    const params: string[] = [];

    if (query.q) {
      conditions.push('(u.name LIKE ? OR u.email LIKE ?)');
      params.push(`%${query.q}%`, `%${query.q}%`);
    }
    if (query.name) {
      conditions.push('u.name LIKE ?');
      params.push(`%${query.name}%`);
    }
    if (query.email) {
      conditions.push('u.email LIKE ?');
      params.push(`%${query.email}%`);
    }
    if (query.role) {
      conditions.push('u.role = ?');
      params.push(query.role);
    }
    if (query.loveLanguages) {
      conditions.push('up.loveLanguages LIKE ?');
      params.push(`%${query.loveLanguages}%`);
    }
    if (query.temperaments) {
      conditions.push('up.temperaments LIKE ?');
      params.push(`%${query.temperaments}%`);
    }
    if (query.favoriteColor) {
      conditions.push('up.favoriteColor LIKE ?');
      params.push(`%${query.favoriteColor}%`);
    }

    return {
      sql: conditions.length ? ` AND ${conditions.join(' AND ')}` : '',
      params,
    };
  }

  /**
   * Coluna e direção da ordenação.
   *
   * Só um nome da tabela de constantes chega ao SQL; o valor recebido nunca é
   * interpolado.
   */
  private orderClause(
    sortBy: ProfileSortField = PROFILE_DEFAULT_SORT,
    order: ProfileSortOrder = PROFILE_DEFAULT_ORDER,
  ): string {
    const column =
      PROFILE_SORT_COLUMNS[sortBy] ??
      PROFILE_SORT_COLUMNS[PROFILE_DEFAULT_SORT];
    const direction =
      order === ProfileSortOrder.DESC
        ? ProfileSortOrder.DESC
        : ProfileSortOrder.ASC;

    // O desempate por id mantém a paginação estável quando duas linhas têm o
    // mesmo valor na coluna ordenada.
    return ` ORDER BY ${column} ${direction}, u.id ASC`;
  }

  /** Uma página de usuários, no recorte que o mapper de perfil consome. */
  async findPage(
    role: UserRole,
    requestingUserId: string,
    query: QueryProfilesDto,
    limit: number,
    offset: number,
  ): Promise<{ users: ProfileUserSource[]; total: number }> {
    const scope = this.scopeClause(role);
    const filters = this.filterClause(query);
    const scopeParams = role === UserRole.COORDINATOR ? [requestingUserId] : [];

    const listSql =
      `SELECT DISTINCT u.id, u.email, u.phone, u.name, u.role, pd.birthDate` +
      `${scope.from}${scope.where}${filters.sql}` +
      `${this.orderClause(query.sortBy, query.order)} LIMIT ? OFFSET ?`;

    const countSql =
      `SELECT COUNT(DISTINCT u.id) AS total` +
      `${scope.from}${scope.where}${filters.sql}`;

    const [users, countRows] = await Promise.all([
      this.dataSource.query<ProfileUserSource[]>(listSql, [
        ...scopeParams,
        ...filters.params,
        limit,
        offset,
      ]),
      this.dataSource.query<CountRow[]>(countSql, [
        ...scopeParams,
        ...filters.params,
      ]),
    ]);

    return { users, total: Number(countRows[0]?.total ?? 0) };
  }

  /**
   * Quem faz aniversário no mês corrente, no recorte mínimo que a faixa de
   * aniversariantes mostra.
   *
   * A tela carregava mil perfis completos só para descobrir isto.
   */
  async findBirthdaysOfCurrentMonth(
    role: UserRole,
    requestingUserId: string,
  ): Promise<ProfileBirthdayRow[]> {
    const scope = this.scopeClause(role);
    const scopeParams = role === UserRole.COORDINATOR ? [requestingUserId] : [];

    const sql =
      `SELECT DISTINCT u.id, u.name, u.role, pd.birthDate` +
      `${scope.from}${scope.where}` +
      ` AND pd.birthDate IS NOT NULL AND MONTH(pd.birthDate) = MONTH(CURDATE())` +
      ` ORDER BY DAY(pd.birthDate) ASC, u.name ASC LIMIT ?`;

    return this.dataSource.query<ProfileBirthdayRow[]>(sql, [
      ...scopeParams,
      PROFILE_BIRTHDAY_MAX_RESULTS,
    ]);
  }
}
