import { Injectable } from '@nestjs/common';

import { AccessContext } from 'src/core/auth/auth.types';

import { CoordinatorProfilesRepository } from '../repositories/coordinator-profiles.repository';
import { CoordinatorProfileEntity } from '../entities/coordinator-profile.entity/coordinator-profile.entity';
import {
  CoordinatorResponseDto,
  toCoordinatorDto,
} from '../dto/coordinator-profile.response.dto';
import { CoordinatorSimpleListDto } from '../dto/coordinator-simple-list.dto';
import {
  CoordinatorProfilesQueryDto,
  PageDto,
} from '../dto/coordinator-profiles.query.dto';
import { assertCanReadCoordinatorProfiles } from '../utils';

/** Leituras de coordenadores. */
@Injectable()
export class GetCoordinatorProfilesService {
  constructor(private readonly repo: CoordinatorProfilesRepository) {}

  async findPage(
    context: AccessContext,
    query: CoordinatorProfilesQueryDto,
  ): Promise<PageDto<CoordinatorResponseDto>> {
    assertCanReadCoordinatorProfiles(context);

    const { items, total, page, limit } =
      await this.repo.findPageWithFilters(query);

    return { items: items.map(toCoordinatorDto), total, page, limit };
  }

  /** Coordenadores no formato usado pelos seletores de formulário. */
  /**
   * Os coordenadores em atividade com os clubinhos de cada um.
   *
   * Contrato para o resumo semanal, que roda por agendamento e não tem sessão
   * — por isso não passa por `assertCanReadCoordinatorProfiles`, que existe
   * para recortar o que um usuário logado enxerga. Devolve a entidade porque
   * quem consome precisa do `user.email`, que os DTOs de listagem não expõem.
   */
  async findAllActiveWithClubs(): Promise<CoordinatorProfileEntity[]> {
    return this.repo.findAllActiveWithClubs();
  }

  async list(context: AccessContext): Promise<CoordinatorSimpleListDto[]> {
    assertCanReadCoordinatorProfiles(context);

    return this.repo.list();
  }

  async findOne(
    context: AccessContext,
    id: string,
  ): Promise<CoordinatorResponseDto> {
    assertCanReadCoordinatorProfiles(context);

    return toCoordinatorDto(
      await this.repo.findOneWithClubsAndTeachersOrFail(id),
    );
  }

  async findByClubId(
    context: AccessContext,
    clubId: string,
  ): Promise<CoordinatorResponseDto> {
    assertCanReadCoordinatorProfiles(context);

    return toCoordinatorDto(
      await this.repo.findByClubIdWithTeachersOrFail(clubId),
    );
  }
}
