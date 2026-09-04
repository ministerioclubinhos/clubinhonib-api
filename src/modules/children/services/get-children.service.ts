import { Injectable } from '@nestjs/common';
import { Request } from 'express';

import { ChildrenRepository } from '../repositories/children.repository';
import { AppNotFoundException, ErrorCode } from 'src/shared/exceptions';

import {
  QueryChildrenDto,
  QueryChildrenSimpleDto,
} from '../dto/query-children.dto';
import {
  PaginatedResponseDto,
  ChildResponseDto,
  ChildListItemDto,
} from '../dto/child-response.dto';
import {
  toChildListItemDto,
  toChildResponseDto,
} from '../mappers/child.mapper';
import { ChildEntity } from '../entities/child.entity';
import { AuthContextService } from 'src/core/auth/services/auth-context.service';
import { CHILDREN_SIMPLE_ORDER, CHILDREN_SIMPLE_ORDER_BY } from '../constants';

@Injectable()
export class GetChildrenService {
  constructor(
    private readonly childrenRepo: ChildrenRepository,
    private readonly authContextService: AuthContextService,
  ) {}

  async findEntityOrFail(id: string, request: Request): Promise<ChildEntity> {
    const ctx = await this.authContextService.resolveAccessContext(request);
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
    const ctx = await this.authContextService.resolveAccessContext(request);
    const { items, total, page, limit, orderBy, order } =
      await this.childrenRepo.findAllPaginated(query, ctx);

    return {
      data: items.map(toChildResponseDto),
      meta: {
        page,
        limit,
        totalItems: total,
        totalPages: Math.ceil(total / limit),
        orderBy,
        order,
      },
    };
  }

  async findAllSimples(
    query: QueryChildrenSimpleDto,
    request: Request,
  ): Promise<PaginatedResponseDto<ChildListItemDto>> {
    const ctx = await this.authContextService.resolveAccessContext(request);
    const { items, total, page, limit } = await this.childrenRepo.findAllSimple(
      query,
      ctx,
    );

    return {
      data: items.map(toChildListItemDto),
      meta: {
        page,
        limit,
        totalItems: total,
        totalPages: Math.ceil(total / limit),
        orderBy: CHILDREN_SIMPLE_ORDER_BY,
        order: CHILDREN_SIMPLE_ORDER,
      },
    };
  }

  async findOne(id: string, request: Request): Promise<ChildResponseDto> {
    const entity = await this.findEntityOrFail(id, request);
    return toChildResponseDto(entity);
  }
}
