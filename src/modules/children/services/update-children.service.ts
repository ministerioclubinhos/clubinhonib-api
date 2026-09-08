import { Injectable } from '@nestjs/common';
import { Request } from 'express';

import { ChildrenRepository } from '../repositories/children.repository';
import { CreateAddressService } from '../../addresses/services/create-address.service';
import { UpdateAddressService } from '../../addresses/services/update-address.service';
import { GetClubsService } from '../../clubs/services/get-clubs.service';
import {
  AppNotFoundException,
  AppForbiddenException,
  ErrorCode,
} from 'src/shared/exceptions';

import { UpdateChildDto } from '../dto/update-child.dto';
import { ChildResponseDto } from '../dto/child-response.dto';
import { toChildResponseDto } from '../mappers/child.mapper';
import { ClubEntity } from '../../clubs/entities/club.entity';
import { AuthContextService } from 'src/core/auth/services/auth-context.service';
import { UserRole } from 'src/core/auth/auth.types';
import {
  assertCanChangeChildClub,
  assertCanUnlinkChildClub,
  toDateOnly,
} from '../utils';

@Injectable()
export class UpdateChildrenService {
  constructor(
    private readonly childrenRepo: ChildrenRepository,
    private readonly createAddressService: CreateAddressService,
    private readonly updateAddressService: UpdateAddressService,
    private readonly getClubsService: GetClubsService,
    private readonly authContextService: AuthContextService,
  ) {}

  async update(
    id: string,
    dto: UpdateChildDto,
    request: Request,
  ): Promise<ChildResponseDto> {
    const ctx = await this.authContextService.resolveAccessContext(request);

    const entity = await this.childrenRepo.findOneForResponse(id, ctx);
    if (!entity) {
      throw new AppNotFoundException(
        ErrorCode.CHILD_NOT_FOUND,
        'Criança não encontrada ou sem acesso',
      );
    }

    if (dto.name !== undefined) entity.name = dto.name;
    if (dto.guardianName !== undefined) entity.guardianName = dto.guardianName;
    if (dto.gender !== undefined) entity.gender = dto.gender;
    if (dto.guardianPhone !== undefined)
      entity.guardianPhone = dto.guardianPhone ?? '';
    if (dto.birthDate !== undefined)
      entity.birthDate = toDateOnly(dto.birthDate) ?? '';
    if (dto.joinedAt !== undefined) entity.joinedAt = toDateOnly(dto.joinedAt);
    if (dto.isActive !== undefined) entity.isActive = dto.isActive;

    // O formulário reenvia o clubinho mesmo quando ninguém mexeu nele, então a
    // regra vale para a **mudança**, não para o campo estar presente: um
    // professor editando o telefone da criança não pode esbarrar nela.
    const clubIdAtual = entity.club?.id ?? null;
    const clubIdNovo = dto.clubId ?? null;

    if (dto.clubId !== undefined && clubIdNovo !== clubIdAtual) {
      assertCanChangeChildClub(ctx);

      if (clubIdNovo === null) {
        assertCanUnlinkChildClub(ctx);
        entity.club = null;
      } else {
        await this.getClubsService.findOne(clubIdNovo, ctx);
        if (ctx.role && ctx.role !== UserRole.ADMIN) {
          const allowed = await this.childrenRepo.userHasAccessToClub(
            clubIdNovo,
            ctx,
          );
          if (!allowed) {
            throw new AppForbiddenException(
              ErrorCode.CHILD_ACCESS_DENIED,
              'Sem acesso ao novo clubinho',
            );
          }
        }
        entity.club = { id: clubIdNovo } as ClubEntity;
      }
    }

    if (dto.address !== undefined) {
      if (dto.address === null) {
        entity.address = null;
      } else {
        if (entity.address) {
          this.updateAddressService.merge(entity.address, dto.address);
        } else {
          entity.address = this.createAddressService.build(dto.address);
        }
      }
    }

    await this.childrenRepo.save(entity);
    const reloaded = await this.childrenRepo.findOneForResponse(id, ctx);
    return toChildResponseDto(reloaded!);
  }

  async toggleActive(id: string, request: Request): Promise<ChildResponseDto> {
    const ctx = await this.authContextService.resolveAccessContext(request);
    const entity = await this.childrenRepo.findOneForResponse(id, ctx);
    if (!entity) {
      throw new AppNotFoundException(
        ErrorCode.CHILD_NOT_FOUND,
        'Criança não encontrada ou sem acesso',
      );
    }

    entity.isActive = !entity.isActive;
    await this.childrenRepo.save(entity);

    const reloaded = await this.childrenRepo.findOneForResponse(id, ctx);
    return toChildResponseDto(reloaded!);
  }
}
