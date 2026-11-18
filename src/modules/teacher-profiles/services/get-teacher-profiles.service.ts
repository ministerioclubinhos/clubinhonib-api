import { Injectable } from '@nestjs/common';

import { AccessContext } from 'src/core/auth/auth.types';

import { TeacherProfilesRepository } from '../repositories/teacher-profiles.repository';
import {
  TeacherResponseDto,
  toTeacherDto,
} from '../dto/teacher-profile.response.dto';
import { TeacherSimpleListDto } from '../dto/teacher-simple-list.dto';
import {
  PageDto,
  TeacherProfilesQueryDto,
} from '../dto/teacher-profiles.query.dto';
import { assertCanAccessTeacherProfiles } from '../utils';

/** Leituras de professores. */
@Injectable()
export class GetTeacherProfilesService {
  constructor(private readonly repo: TeacherProfilesRepository) {}

  async findPage(
    context: AccessContext,
    query: TeacherProfilesQueryDto,
  ): Promise<PageDto<TeacherResponseDto>> {
    assertCanAccessTeacherProfiles(context);

    const { items, total, page, limit } = await this.repo.findPageWithFilters(
      query,
      context,
    );

    return { items: items.map(toTeacherDto), total, page, limit };
  }

  /** Professores no formato usado pelos seletores de formulário. */
  async list(context: AccessContext): Promise<TeacherSimpleListDto[]> {
    assertCanAccessTeacherProfiles(context);

    return this.repo.list(context);
  }

  async findOne(
    context: AccessContext,
    id: string,
  ): Promise<TeacherResponseDto> {
    assertCanAccessTeacherProfiles(context);

    return toTeacherDto(
      await this.repo.findOneWithClubAndCoordinatorOrFail(id, context),
    );
  }

  async findByClubId(
    context: AccessContext,
    clubId: string,
  ): Promise<TeacherResponseDto[]> {
    assertCanAccessTeacherProfiles(context);

    const teachers = await this.repo.findByClubIdWithCoordinator(
      clubId,
      context,
    );
    return teachers.map(toTeacherDto);
  }
}
