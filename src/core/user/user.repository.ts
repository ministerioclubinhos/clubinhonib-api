import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, IsNull, Repository } from 'typeorm';
import { UserEntity } from './entities/user.entity';
import { GetUsersQueryDto } from './dto/get-users-query.dto';
import { UserRole } from 'src/core/auth/auth.types';
import { EmailRecipient } from 'src/shared/email/types';
import { AppNotFoundException, ErrorCode } from 'src/shared/exceptions';
import {
  SortOrder,
  USERS_DEFAULT_LIMIT,
  USERS_DEFAULT_PAGE,
  USERS_MAX_LIMIT,
  USER_DEFAULT_ORDER,
  USER_DEFAULT_SORT,
  USER_SORT_COLUMNS,
  UserSortField,
} from './constants';

/** Uma página de usuários, como o banco a devolve. */
export interface PaginatedUsers {
  items: UserEntity[];
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  sort: UserSortField;
  order: SortOrder;
}

@Injectable()
export class UserRepository {
  constructor(
    @InjectRepository(UserEntity)
    private readonly repo: Repository<UserEntity>,
  ) {}

  async create(user: Partial<UserEntity>): Promise<UserEntity> {
    const newUser = this.repo.create(user);
    return this.repo.save(newUser);
  }

  async findAll(): Promise<UserEntity[]> {
    return this.repo.find();
  }

  async findById(id: string): Promise<UserEntity | null> {
    return this.repo.findOne({ where: { id } });
  }

  /**
   * Quem recebe os avisos enviados a toda a base.
   *
   * Só id, nome e endereço são carregados — nenhum aviso precisa do resto — e
   * quem pediu para sair da lista fica de fora. O id entra porque o rodapé do
   * aviso leva um link de descadastro assinado para aquela pessoa.
   */
  async findActiveRecipients(): Promise<EmailRecipient[]> {
    return this.repo.find({
      where: { active: true, noticesUnsubscribedAt: IsNull() },
      select: { id: true, name: true, email: true },
      order: { email: 'ASC' },
    });
  }

  /**
   * Dos ids informados, quem pode receber um aviso.
   *
   * É a mesma régua de `findActiveRecipients`, aplicada a um recorte: conta
   * ativa e ninguém que pediu para sair da lista. Existe porque os avisos de
   * clubinho partem de uma pessoa conhecida — os professores daquele clube, o
   * coordenador dele —, e as consultas de clube não sabem nada de elegibilidade:
   * elas trariam professor inativo e quem já se descadastrou.
   *
   * Quem chama diz **quem**; quem decide **se pode** é este método, para a regra
   * não ser reescrita em cada módulo que precisar avisar alguém.
   */
  async findNoticeRecipientsByIds(ids: string[]): Promise<EmailRecipient[]> {
    const unique = [...new Set(ids.filter((id) => id.trim().length > 0))];
    if (unique.length === 0) return [];

    return this.repo.find({
      where: {
        id: In(unique),
        active: true,
        noticesUnsubscribedAt: IsNull(),
      },
      select: { id: true, name: true, email: true },
      order: { email: 'ASC' },
    });
  }

  /** Registra — ou desfaz — a saída da lista de avisos. */
  async setNoticesUnsubscribedAt(
    id: string,
    unsubscribedAt: Date | null,
  ): Promise<void> {
    await this.repo.update(id, { noticesUnsubscribedAt: unsubscribedAt });
  }

  /**
   * E-mails de todos os administradores cadastrados no banco de dados.
   */
  async findAdminEmails(): Promise<string[]> {
    const admins = await this.repo.find({
      where: { role: UserRole.ADMIN },
      select: { email: true },
    });
    return admins
      .map((admin) => admin.email)
      .filter((email) => Boolean(email && email.trim()));
  }

  async findByEmail(email: string): Promise<UserEntity | null> {
    return this.repo.findOne({ where: { email } });
  }

  async findByCpf(cpf: string): Promise<UserEntity | null> {
    return this.repo.findOne({ where: { cpf } });
  }

  async findByIdWithProfiles(id: string): Promise<UserEntity | null> {
    return this.repo.findOne({
      where: { id },
      relations: {
        teacherProfile: { club: true },
        coordinatorProfile: { clubs: true },
      },
    });
  }

  async update(id: string, data: Partial<UserEntity>): Promise<UserEntity> {
    await this.repo.update(id, data);
    const updated = await this.findById(id);
    if (!updated) {
      throw new AppNotFoundException(
        ErrorCode.USER_NOT_FOUND,
        'Usuário não encontrado',
      );
    }
    return updated;
  }

  async delete(id: string): Promise<void> {
    await this.repo.delete(id);
  }

  async updateRefreshToken(
    id: string,
    refreshToken: string | null,
  ): Promise<void> {
    await this.repo.update(id, { refreshToken });
  }

  async findAllPaginated(q: GetUsersQueryDto): Promise<PaginatedUsers> {
    const {
      page = USERS_DEFAULT_PAGE,
      limit: rawLimit = USERS_DEFAULT_LIMIT,
      q: term,
      role,
      active,
      completed,
      sort = USER_DEFAULT_SORT,
      order = USER_DEFAULT_ORDER,
    } = q;

    const limit = Math.min(Math.max(rawLimit, 1), USERS_MAX_LIMIT);
    const skip = (page - 1) * limit;

    // Só um nome da tabela de colunas chega ao SQL; o valor recebido nunca é
    // interpolado.
    const sortColumn =
      USER_SORT_COLUMNS[sort] ?? USER_SORT_COLUMNS[USER_DEFAULT_SORT];
    const sortDirection =
      order === SortOrder.ASC ? SortOrder.ASC : SortOrder.DESC;

    const qb = this.repo
      .createQueryBuilder('u')
      .select([
        'u.id',
        'u.createdAt',
        'u.updatedAt',
        'u.email',
        'u.phone',
        'u.name',
        'u.cpf',
        'u.active',
        'u.completed',
        'u.commonUser',
        'u.role',
      ]);

    // A tela administra quem trabalha no clubinho; outro administrador não é
    // gerenciado por aqui.
    qb.andWhere('u.role <> :adminRole', { adminRole: UserRole.ADMIN });

    if (term) {
      const like = `%${term}%`;
      qb.andWhere(
        '(LOWER(u.name) LIKE LOWER(:like) OR LOWER(u.email) LIKE LOWER(:like) OR LOWER(u.phone) LIKE LOWER(:like) OR LOWER(u.role) LIKE LOWER(:like))',
        { like },
      );
    }

    if (role) {
      qb.andWhere('u.role = :role', { role });
    }

    if (typeof active === 'boolean') {
      qb.andWhere('u.active = :active', { active });
    }

    if (typeof completed === 'boolean') {
      qb.andWhere('u.completed = :completed', { completed });
    }

    // O desempate por id mantém a paginação estável quando duas linhas têm o
    // mesmo valor na coluna ordenada.
    qb.orderBy(sortColumn, sortDirection)
      .addOrderBy('u.id', SortOrder.ASC)
      .skip(skip)
      .take(limit);

    const [items, total] = await qb.getManyAndCount();

    return {
      items,
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
      sort,
      order: sortDirection,
    };
  }
}
