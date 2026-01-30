import { Injectable } from '@nestjs/common';
import { Request } from 'express';

import { ChildrenRepository } from './repositories/children.repository';
import { AddressesService } from '../addresses/addresses.service';
import { GetClubsService } from '../clubs/services/get-clubs.service';
import {
  AppNotFoundException,
  AppForbiddenException,
  ErrorCode,
} from 'src/shared/exceptions';

import { CreateChildDto } from './dto/create-child.dto';
import { UpdateChildDto } from './dto/update-child.dto';
import {
  QueryChildrenDto,
  QueryChildrenSimpleDto,
} from './dto/query-children.dto';
import {
  PaginatedResponseDto,
  ChildResponseDto,
  ChildListItemDto,
} from './dto/child-response.dto';
import { toChildListItemDto, toChildResponseDto } from './mappers/child.mapper';
import { ClubEntity } from '../clubs/entities/club.entity/club.entity';
import { AuthContextService } from 'src/core/auth/services/auth-context.service';

const toDateOnlyStr = (v: string | Date | undefined | null): string | null => {
  if (v === undefined || v === null) return null;
  if (v instanceof Date && !isNaN(v.getTime()))
    return v.toISOString().slice(0, 10);
  const s = String(v).trim();
  const m = s.match(/^(\d{4}-\d{2}-\d{2})$/);
  if (m) return m[1];
  const d = new Date(s);
  return isNaN(d.getTime()) ? null : d.toISOString().slice(0, 10);
};

type AccessCtx = { role?: string; userId?: string | null };

@Injectable()
export class ChildrenService {
  constructor(
    private readonly childrenRepo: ChildrenRepository,
    private readonly addressesService: AddressesService,
    private readonly getClubsService: GetClubsService,
    private readonly authContextService: AuthContextService,
  ) {}

  private async getCtx(request: Request): Promise<AccessCtx> {
    const payload = await this.authContextService.tryGetPayload(request);
    return {
      role: payload?.role?.toString().toLowerCase(),
      userId: payload?.sub ?? null,
    };
  }

  async findAll(
    query: QueryChildrenDto,
    request: Request,
  ): Promise<PaginatedResponseDto<ChildResponseDto>> {
    const ctx = await this.getCtx(request);
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;

    const { items, total } = await this.childrenRepo.findAllPaginated(
      query,
      ctx,
    );

    return {
      data: items.map(toChildResponseDto),
      meta: {
        page,
        limit,
        totalItems: total,
        totalPages: Math.ceil(total / limit),
        orderBy: query.orderBy ?? 'name',
        order: (query.order ?? 'ASC').toUpperCase() as 'ASC' | 'DESC',
      },
    };
  }

  async findAllSimples(
    query: QueryChildrenSimpleDto,
    request: Request,
  ): Promise<PaginatedResponseDto<ChildListItemDto>> {
    const ctx = await this.getCtx(request);
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;

    const { items, total } = await this.childrenRepo.findAllSimple(query, ctx);

    return {
      data: items.map(toChildListItemDto),
      meta: {
        page,
        limit,
        totalItems: total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async findOne(id: string, request: Request): Promise<ChildResponseDto> {
    const ctx = await this.getCtx(request);
    const entity = await this.childrenRepo.findOneForResponse(id, ctx);
    if (!entity)
      throw new AppNotFoundException(
        ErrorCode.CHILD_NOT_FOUND,
        'Criança não encontrada ou sem acesso',
      );
    return toChildResponseDto(entity);
  }

  async create(
    dto: CreateChildDto,
    request: Request,
  ): Promise<ChildResponseDto> {
    const ctx = await this.getCtx(request);

    if (ctx.role && ctx.role !== 'admin' && dto.clubId) {
      const allowed = await this.childrenRepo.userHasAccessToClub(
        dto.clubId,
        ctx,
      );
      if (!allowed)
        throw new AppForbiddenException(
          ErrorCode.CHILD_ACCESS_DENIED,
          'Sem acesso ao clubinho informado',
        );
    }

    const child = this.childrenRepo.create({
      name: dto.name,
      guardianName: dto.guardianName,
      gender: dto.gender,
      guardianPhone: dto.guardianPhone,
      birthDate: toDateOnlyStr(dto.birthDate) ?? '',
      joinedAt: toDateOnlyStr(dto.joinedAt),
      isActive: dto.isActive !== undefined ? dto.isActive : true,
    });

    if (dto.clubId) {
      await this.getClubsService.findOne(dto.clubId, request);
      child.club = { id: dto.clubId } as ClubEntity;
    }

    if (dto.address) {
      const address = this.addressesService.create(dto.address);
      child.address = address;
    }

    const saved = await this.childrenRepo.save(child);
    const withRels = await this.childrenRepo.findOneForResponse(saved.id, ctx);
    return toChildResponseDto(withRels!);
  }

  async update(
    id: string,
    dto: UpdateChildDto,
    request: Request,
  ): Promise<ChildResponseDto> {
    const ctx = await this.getCtx(request);

    const entity = await this.childrenRepo.findOneForResponse(id, ctx);
    if (!entity)
      throw new AppNotFoundException(
        ErrorCode.CHILD_NOT_FOUND,
        'Criança não encontrada ou sem acesso',
      );

    if (dto.name !== undefined) entity.name = dto.name;
    if (dto.guardianName !== undefined) entity.guardianName = dto.guardianName;
    if (dto.gender !== undefined) entity.gender = dto.gender;
    if (dto.guardianPhone !== undefined)
      entity.guardianPhone = dto.guardianPhone;
    if (dto.birthDate !== undefined)
      entity.birthDate = toDateOnlyStr(dto.birthDate) ?? '';
    if (dto.joinedAt !== undefined)
      entity.joinedAt = toDateOnlyStr(dto.joinedAt);
    if (dto.isActive !== undefined) entity.isActive = dto.isActive;

    if (dto.clubId !== undefined) {
      if (dto.clubId === null) {
        entity.club = null;
      } else {
        await this.getClubsService.findOne(dto.clubId, request);
        if (ctx.role && ctx.role !== 'admin') {
          const allowed = await this.childrenRepo.userHasAccessToClub(
            dto.clubId,
            ctx,
          );
          if (!allowed)
            throw new AppForbiddenException(
              ErrorCode.CHILD_ACCESS_DENIED,
              'Sem acesso ao novo clubinho',
            );
        }
        entity.club = { id: dto.clubId } as ClubEntity;
      }
    }

    if (dto.address !== undefined) {
      if (dto.address === null) {
        entity.address = null;
      } else {
        if (entity.address) {
          this.addressesService.merge(entity.address, dto.address);
        } else {
          entity.address = this.addressesService.create(dto.address);
        }
      }
    }

    await this.childrenRepo.save(entity);
    const reloaded = await this.childrenRepo.findOneForResponse(id, ctx);
    return toChildResponseDto(reloaded!);
  }

  async remove(id: string, request: Request): Promise<void> {
    const ctx = await this.getCtx(request);
    const entity = await this.childrenRepo.findOneForResponse(id, ctx);
    if (!entity)
      throw new AppNotFoundException(
        ErrorCode.CHILD_NOT_FOUND,
        'Criança não encontrada ou sem acesso',
      );
    await this.childrenRepo.delete(id);
  }

  async toggleActive(id: string, request: Request): Promise<ChildResponseDto> {
    const ctx = await this.getCtx(request);
    const entity = await this.childrenRepo.findOneForResponse(id, ctx);
    if (!entity)
      throw new AppNotFoundException(
        ErrorCode.CHILD_NOT_FOUND,
        'Criança não encontrada ou sem acesso',
      );

    entity.isActive = !entity.isActive;
    await this.childrenRepo.save(entity);

    const reloaded = await this.childrenRepo.findOneForResponse(id, ctx);
    return toChildResponseDto(reloaded!);
  }
}
