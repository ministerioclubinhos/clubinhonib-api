import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Request } from 'express';

import { TeacherProfilesRepository } from '../repositories/teacher-profiles.repository';
import {
  TeacherResponseDto,
  toTeacherDto,
} from '../dto/teacher-profile.response.dto';
import { TeacherSimpleListDto } from '../dto/teacher-simple-list.dto';
import { AuthContextService } from 'src/auth/services/auth-context.service';
import { PageDto, TeacherProfilesQueryDto } from '../dto/teacher-profiles.query.dto';

type AccessCtx = { role?: string; userId?: string | null };

@Injectable()
export class TeacherProfilesService {
  constructor(
    private readonly repo: TeacherProfilesRepository,
    private readonly authCtx: AuthContextService,
  ) { }

  private async getCtx(req: Request): Promise<AccessCtx> {
    const payload = await this.authCtx.tryGetPayload(req);
    return {
      role: payload?.role?.toString().toLowerCase(),
      userId: payload?.sub ?? null,
    };
  }
  async findPage(
    req: Request,
    query: TeacherProfilesQueryDto,
  ): Promise<PageDto<TeacherResponseDto>> {
    const ctx = await this.getCtx(req);
    this.assertAllowed(ctx);

    const { items, total, page, limit } = await this.repo.findPageWithFilters(query, ctx);
    return {
      items: items.map(toTeacherDto),
      total,
      page,
      limit,
    };
  }
  private assertAllowed(ctx: AccessCtx) {
    if (!ctx.role) throw new ForbiddenException('Acesso negado');
    if (ctx.role === 'teacher') throw new ForbiddenException('Acesso negado');
  }

  async findAll(req: Request): Promise<TeacherResponseDto[]> {
    const ctx = await this.getCtx(req);
    this.assertAllowed(ctx);

    const teachers = await this.repo.findAllWithClubAndCoordinator(ctx);
    return teachers.map(toTeacherDto);
  }

  async list(req: Request): Promise<TeacherSimpleListDto[]> {
    const ctx = await this.getCtx(req);
    this.assertAllowed(ctx);

    return await this.repo.list(ctx);
  }

  async findOne(id: string, req: Request): Promise<TeacherResponseDto> {
    const ctx = await this.getCtx(req);
    this.assertAllowed(ctx);

    const teacher = await this.repo.findOneWithClubAndCoordinatorOrFail(id, ctx);
    return toTeacherDto(teacher);
  }

  async findByClubId(clubId: string, req: Request): Promise<TeacherResponseDto[]> {
    const ctx = await this.getCtx(req);
    this.assertAllowed(ctx);

    const teachers = await this.repo.findByClubIdWithCoordinator(clubId, ctx);
    return teachers.map(toTeacherDto);
  }

  async assignClub(teacherId: string, clubId: string, req: Request): Promise<void> {
    const ctx = await this.getCtx(req);
    this.assertAllowed(ctx);

    if (ctx.role !== 'admin') {
      const allowed = await this.repo.userHasAccessToClub(clubId, ctx);
      if (!allowed) throw new ForbiddenException('Sem acesso ao club informado');
    }
    await this.repo.assignTeacherToClub(teacherId, clubId);
  }

  async unassignClub(teacherId: string, expectedClubId: string | undefined, req: Request): Promise<void> {
    const ctx = await this.getCtx(req);
    this.assertAllowed(ctx);

    if (ctx.role !== 'admin') {
      if (expectedClubId) {
        const allowed = await this.repo.userHasAccessToClub(expectedClubId, ctx);
        if (!allowed) throw new ForbiddenException('Sem acesso ao club informado');
      } else {
        const t = await this.repo.findOneWithClubAndCoordinatorOrFail(teacherId, ctx);
        const currentClubId = t.club?.id;
        if (currentClubId) {
          const allowed = await this.repo.userHasAccessToClub(currentClubId, ctx);
          if (!allowed) throw new ForbiddenException('Sem acesso ao club atual do teacher');
        } else {
          throw new ForbiddenException('Teacher não possui club para desvincular');
        }
      }
    }

    await this.repo.unassignTeacherFromClub(teacherId, expectedClubId);
  }

  async createForUser(userId: string) {
    return this.repo.createForUser(userId);
  }

  async removeByUserId(userId: string) {
    return this.repo.removeByUserId(userId);
  }
}
