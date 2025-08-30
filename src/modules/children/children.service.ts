// src/modules/children/children.service.ts
import { Injectable, NotFoundException } from '@nestjs/common';
import { ChildrenRepository } from './repositories/children.repository';
import { AddressesService } from '../addresses/addresses.service';
import { GetClubsService } from '../clubs/services/get-clubs.service';

import { CreateChildDto } from './dto/create-child.dto';
import { UpdateChildDto } from './dto/update-child.dto';
import { QueryChildrenDto, QueryChildrenSimpleDto } from './dto/query-children.dto';
import {
  PaginatedResponseDto,
  ChildResponseDto,
  ChildListItemDto,
} from './dto/child-response.dto';
import { toChildListItemDto, toChildResponseDto } from './mappers/child.mapper';
import { ClubEntity } from '../clubs/entities/club.entity/club.entity';

const toDateOnlyStr = (v: string | Date | undefined | null): string | null => {
  if (v === undefined || v === null) return null;
  if (v instanceof Date && !isNaN(v.getTime())) return v.toISOString().slice(0, 10);
  const s = String(v).trim();
  const m = s.match(/^(\d{4}-\d{2}-\d{2})$/);
  if (m) return m[1];
  const d = new Date(s);
  return isNaN(d.getTime()) ? null : d.toISOString().slice(0, 10);
};

@Injectable()
export class ChildrenService {
  constructor(
    private readonly childrenRepo: ChildrenRepository,
    private readonly addressesService: AddressesService,
    private readonly getClubsService: GetClubsService,
  ) {}

// src/modules/children/children.service.ts  (trecho findAll)
async findAll(q: QueryChildrenDto): Promise<PaginatedResponseDto<ChildResponseDto>> {
  const page = q.page ?? 1;
  const limit = q.limit ?? 20;

  const { items, total } = await this.childrenRepo.findAllPaginated(q);

  return {
    data: items.map(toChildResponseDto),
    meta: {
      page,
      limit,
      totalItems: total,
      totalPages: Math.ceil(total / limit),
      orderBy: q.orderBy ?? 'name',
      order: (q.order ?? 'ASC').toUpperCase() as any,
    },
  };
}

  async findAllSimples(q: QueryChildrenSimpleDto): Promise<ChildListItemDto[]> {
    const rows = await this.childrenRepo.findAllSimple(q);
    return rows.map(toChildListItemDto);
  }

  async findOne(id: string): Promise<ChildResponseDto> {
    const entity = await this.childrenRepo.findOneOrFailForResponse(id);
    if (!entity) throw new NotFoundException('Criança não encontrada');
    return toChildResponseDto(entity);
  }

  async create(dto: CreateChildDto): Promise<ChildResponseDto> {
    const child = this.childrenRepo.create({
      name: dto.name,
      guardianName: dto.guardianName,
      gender: dto.gender,
      guardianPhone: dto.guardianPhone,
      birthDate: toDateOnlyStr(dto.birthDate) as any, 
      joinedAt: toDateOnlyStr(dto.joinedAt) as any,
    });

    // clube: valida via service e seta stub
    if (dto.clubId) {
      await this.getClubsService.findOne(dto.clubId); // lança NotFound se não existir
      (child as any).club = { id: dto.clubId } as ClubEntity;
    }

    // endereço
    if (dto.address) {
      const address = this.addressesService.create(dto.address);
      (child as any).address = address;
    }

    const saved = await this.childrenRepo.save(child);
    const withRels = await this.childrenRepo.findOneOrFailForResponse(saved.id);
    return toChildResponseDto(withRels!);
  }

  async update(id: string, dto: UpdateChildDto): Promise<ChildResponseDto> {
    const entity = await this.childrenRepo.findOneOrFailForResponse(id);
    if (!entity) throw new NotFoundException('Criança não encontrada');

    // campos simples
    if (dto.name !== undefined) entity.name = dto.name;
    if (dto.guardianName !== undefined) entity.guardianName = dto.guardianName;
    if (dto.gender !== undefined) entity.gender = dto.gender;
    if (dto.guardianPhone !== undefined) entity.guardianPhone = dto.guardianPhone;
    if (dto.birthDate !== undefined) entity.birthDate = toDateOnlyStr(dto.birthDate) as any;
    if (dto.joinedAt !== undefined) entity.joinedAt = toDateOnlyStr(dto.joinedAt) as any;

    // clube
    if (dto.clubId !== undefined) {
      if (dto.clubId === null) {
        (entity as any).club = null;
      } else {
        await this.getClubsService.findOne(dto.clubId);
        (entity as any).club = { id: dto.clubId } as ClubEntity;
      }
    }

    // endereço
    if (dto.address !== undefined) {
      if (dto.address === null) {
        (entity as any).address = null;
      } else {
        if (entity.address) {
          this.addressesService.merge(entity.address, dto.address);
        } else {
          (entity as any).address = this.addressesService.create(dto.address);
        }
      }
    }

    await this.childrenRepo.save(entity);
    const reloaded = await this.childrenRepo.findOneOrFailForResponse(id);
    return toChildResponseDto(reloaded!);
  }

  async remove(id: string): Promise<void> {
    const entity = await this.childrenRepo.findOneOrFailForResponse(id);
    if (!entity) throw new NotFoundException('Criança não encontrada');
    await this.childrenRepo.delete(id);
  }
}
