import { Injectable } from '@nestjs/common';
import { Request } from 'express';

import { ChildrenRepository } from '../repositories/children.repository';
import { CreateAddressService } from '../../addresses/services/create-address.service';
import { GetClubsService } from '../../clubs/services/get-clubs.service';
import { AppForbiddenException, ErrorCode } from 'src/shared/exceptions';

import { CreateChildDto } from '../dto/create-child.dto';
import { ChildResponseDto } from '../dto/child-response.dto';
import { toChildResponseDto } from '../mappers/child.mapper';
import { ClubEntity } from '../../clubs/entities/club.entity';
import { AuthContextService } from 'src/core/auth/services/auth-context.service';
import { UserRole } from 'src/core/auth/auth.types';
import { toDateOnly } from '../utils';

@Injectable()
export class CreateChildrenService {
  constructor(
    private readonly childrenRepo: ChildrenRepository,
    private readonly createAddressService: CreateAddressService,
    private readonly getClubsService: GetClubsService,
    private readonly authContextService: AuthContextService,
  ) {}

  async create(
    dto: CreateChildDto,
    request: Request,
  ): Promise<ChildResponseDto> {
    const ctx = await this.authContextService.resolveAccessContext(request);

    if (dto.clubId && ctx.role && ctx.role !== UserRole.ADMIN) {
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
      birthDate: toDateOnly(dto.birthDate) ?? '',
      joinedAt: toDateOnly(dto.joinedAt),
      isActive: dto.isActive !== undefined ? dto.isActive : true,
    });

    if (dto.clubId) {
      await this.getClubsService.findOne(dto.clubId, ctx);
      child.club = { id: dto.clubId } as ClubEntity;
    }

    if (dto.address) {
      const address = this.createAddressService.build(dto.address);
      child.address = address;
    }

    const saved = await this.childrenRepo.save(child);
    const withRels = await this.childrenRepo.findOneForResponse(saved.id, ctx);
    return toChildResponseDto(withRels!);
  }
}
