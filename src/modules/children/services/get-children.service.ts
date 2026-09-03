import { Injectable } from '@nestjs/common';
import { Request } from 'express';

import { ChildrenRepository } from '../repositories/children.repository';
import {
  AppNotFoundException,
  ErrorCode,
} from 'src/shared/exceptions';

import {
  QueryChildrenDto,
  QueryChildrenSimpleDto,
} from '../dto/query-children.dto';
import {
  PaginatedResponseDto,
  ChildResponseDto,
  ChildListItemDto,
} from '../dto/child-response.dto';
import { toChildListItemDto, toChildResponseDto } from '../mappers/child.mapper';
import { ChildEntity } from '../entities/child.entity';
import { AuthContextService } from 'src/core/auth/services/auth-context.service';

type AccessCtx = { role?: string; userId?: string | null };

@Injectable()
export class GetChildrenService {
  constructor(
    private readonly childrenRepo: ChildrenRepository,
    private readonly authContextService: AuthContextService,
  ) {}

  private async getCtx(request: Request): Promise<AccessCtx> {
    const payload = await this.authContextService.tryGetPayload(request);
    return {
      role: payload?.role?.toString().toLowerCase(),
      userId: payload?.sub ?? null,
    };
  }

  async findEntityOrFail(id: string, request: Request): Promise<ChildEntity> {
    const ctx = await this.getCtx(request);
    const entity = await this.childrenRepo.findOneForResponse(id, ctx);
    if (!entity) {
      throw new AppNotFoundException(
        ErrorCode.CHILD_NOT_FOUND,
        'Criança não encontrada ou sem acesso',
      );
    }
    return entity;
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
    const entity = await this.findEntityOrFail(id, request);
    return toChildResponseDto(entity);
  }
}
