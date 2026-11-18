import { Injectable, Logger } from '@nestjs/common';

import { AppNotFoundException, ErrorCode } from 'src/shared/exceptions';
import { Paginated } from 'src/shared/dto/paginated.dto';

import { InformativesRepository } from '../repositories/informatives.repository';
import { InformativeEntity } from '../entities/informative.entity';
import { InformativeResponseDto } from '../dto/informative-response.dto';
import { QueryInformativesDto } from '../dto/query-informatives.dto';
import { toInformativeResponse } from '../mappers';
import {
  INFORMATIVES_DEFAULT_LIMIT,
  INFORMATIVES_DEFAULT_PAGE,
} from '../constants';

@Injectable()
export class GetInformativeService {
  private readonly logger = new Logger(GetInformativeService.name);

  constructor(private readonly informativeRepo: InformativesRepository) {}

  /** Entidade crua, para os serviços de escrita deste módulo. */
  async findEntityOrFail(id: string): Promise<InformativeEntity> {
    const found = await this.informativeRepo.findById(id);

    if (!found) {
      this.logger.warn(`⚠️ Banner não encontrado: ID=${id}`);
      throw new AppNotFoundException(
        ErrorCode.INFORMATIVE_NOT_FOUND,
        'Banner informativo não encontrado',
      );
    }

    return found;
  }

  async findAllPaginated(
    query: QueryInformativesDto,
  ): Promise<Paginated<InformativeResponseDto>> {
    const page = query.page ?? INFORMATIVES_DEFAULT_PAGE;
    const limit = query.limit ?? INFORMATIVES_DEFAULT_LIMIT;

    const { items, total } = await this.informativeRepo.findAllPaginated(query);

    return {
      data: items.map(toInformativeResponse),
      total,
      page,
      limit,
      pageCount: Math.ceil(total / limit),
    };
  }

  async findOne(id: string): Promise<InformativeResponseDto> {
    const found = await this.findEntityOrFail(id);
    return toInformativeResponse(found);
  }
}
