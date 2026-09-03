import { Injectable } from '@nestjs/common';
import { Request } from 'express';

import { ChildrenRepository } from '../repositories/children.repository';
import { AddressesService } from '../../addresses/addresses.service';
import { GetClubsService } from '../../clubs/services/get-clubs.service';
import {
  AppForbiddenException,
  ErrorCode,
} from 'src/shared/exceptions';

import { CreateChildDto } from '../dto/create-child.dto';
import { ChildResponseDto } from '../dto/child-response.dto';
import { toChildResponseDto } from '../mappers/child.mapper';
import { ClubEntity } from '../../clubs/entities/club.entity';
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
export class CreateChildrenService {
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

  async create(
    dto: CreateChildDto,
    request: Request,
  ): Promise<ChildResponseDto> {
    const ctx = await this.getCtx(request);

    if (dto.clubId && ctx.role && ctx.role !== 'admin') {
      const allowed = await this.childrenRepo.userHasAccessToClub(
        dto.clubId,
        ctx,
      );
      if (!allowed) {
        throw new AppForbiddenException(
          ErrorCode.CHILD_ACCESS_DENIED,
          'Sem acesso ao clubinho informado',
        );
      }
    }

    const child = this.childrenRepo.create({
      name: dto.name,
      guardianName: dto.guardianName,
      gender: dto.gender,
      guardianPhone: dto.guardianPhone ?? '',
      birthDate: toDateOnlyStr(dto.birthDate) ?? '',
      joinedAt: toDateOnlyStr(dto.joinedAt),
      isActive: dto.isActive !== undefined ? dto.isActive : true,
    });

    if (dto.clubId) {
      await this.getClubsService.findOne(dto.clubId, ctx);
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
}
