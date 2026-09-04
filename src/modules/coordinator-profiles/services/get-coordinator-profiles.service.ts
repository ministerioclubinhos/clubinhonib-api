import { Injectable } from '@nestjs/common';

import { AccessContext } from 'src/core/auth/auth.types';

import { CoordinatorProfilesRepository } from '../repositories/coordinator-profiles.repository';
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
