import { Injectable } from '@nestjs/common';

import { AppNotFoundException, ErrorCode } from 'src/shared/exceptions';
import { Paginated } from 'src/shared/dto/paginated.dto';

import { PagelasRepository } from '../repositories/pagelas.repository';
import { QueryPagelasDto } from '../dto/query-pagelas.dto';
import { PagelaResponseDto } from '../dto/pagela-response.dto';
import { PagelaEntity } from '../entities/pagela.entity';
import { PagelaAccessContext } from '../types';
import { toPagelaResponse } from '../mappers';
import { assertCanAccessPagelas } from '../utils';
import { PAGELAS_DEFAULT_LIMIT, PAGELAS_DEFAULT_PAGE } from '../constants';

/**
 * Leitura de pagelas.
 *
 * O que cada papel enxerga é decidido no repositório: administrador vê tudo,
 * coordenador e professor só o que está sob o alcance deles.
 */
@Injectable()
export class GetPagelasService {
  constructor(private readonly pagelasRepository: PagelasRepository) {}

  /** Carrega a pagela dentro do alcance de quem pede, ou falha. */
  async findEntityOrFail(
    id: string,
    context: PagelaAccessContext,
  ): Promise<PagelaEntity> {
    assertCanAccessPagelas(context);

    const pagela = await this.pagelasRepository.findOneInScope(id, context);

    if (!pagela) {
      throw new AppNotFoundException(
        ErrorCode.PAGELA_NOT_FOUND,
        'Pagela não encontrada',
      );
    }

    return pagela;
  }

  async findAll(
    query: QueryPagelasDto,
    context: PagelaAccessContext,
  ): Promise<PagelaResponseDto[]> {
    assertCanAccessPagelas(context);

    const items = await this.pagelasRepository.findAll(query, context);
    return items.map(toPagelaResponse);
  }

  async findAllPaginated(
    query: QueryPagelasDto,
    context: PagelaAccessContext,
  ): Promise<Paginated<PagelaResponseDto>> {
    assertCanAccessPagelas(context);

    const page = query.page ?? PAGELAS_DEFAULT_PAGE;
    const limit = query.limit ?? PAGELAS_DEFAULT_LIMIT;

    const { items, total } = await this.pagelasRepository.findAllPaginated(
      query,
      context,
      page,
      limit,
    );

    return new Paginated(items.map(toPagelaResponse), total, page, limit);
  }

  async findOne(
    id: string,
    context: PagelaAccessContext,
  ): Promise<PagelaResponseDto> {
    return toPagelaResponse(await this.findEntityOrFail(id, context));
  }
}
