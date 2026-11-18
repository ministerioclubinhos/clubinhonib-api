import { Injectable } from '@nestjs/common';
import { AppNotFoundException, ErrorCode } from 'src/shared/exceptions';
import { Paginated } from 'src/shared/dto/paginated.dto';
import { ClubsRepository } from '../repositories/clubs.repository';
import { QueryClubsDto } from '../dto/query-clubs.dto';
import {
  ClubResponseDto,
  ClubSimpleResponseDto,
} from '../dto/club.response.dto';
import { ClubSelectOptionDto } from '../dto/club-select-option.dto';
import { ClubEntity } from '../entities/club.entity';
import { ClubAccessContext } from '../types';
import { toClubResponse, toClubSimpleResponse } from '../mappers';
import { assertCanManageClubs } from '../utils';
import { CLUBS_DEFAULT_LIMIT, CLUBS_DEFAULT_PAGE } from '../constants';

/**
 * Leitura de clubinhos.
 *
 * O contexto de quem pede chega pronto do controller: o caso de uso não
 * enxerga a requisição HTTP.
 */
@Injectable()
export class GetClubsService {
  constructor(private readonly clubsRepository: ClubsRepository) {}

  /** Carrega o clubinho respeitando o alcance de quem pede, ou falha. */
  async findEntityOrFail(
    id: string,
    context: ClubAccessContext,
  ): Promise<ClubEntity> {
    const club = await this.clubsRepository.findOneOrFailForResponse(
      id,
      context,
    );

    if (!club) {
      throw new AppNotFoundException(
        ErrorCode.CLUB_NOT_FOUND,
        'Clubinho não encontrado',
      );
    }

    return club;
  }

  async findAllPaginated(
    query: QueryClubsDto,
    context: ClubAccessContext,
  ): Promise<Paginated<ClubResponseDto>> {
    assertCanManageClubs(context);

    const page = query.page ?? CLUBS_DEFAULT_PAGE;
    const limit = query.limit ?? CLUBS_DEFAULT_LIMIT;
    const { items, total } = await this.clubsRepository.findAllPaginated(
      query,
      context,
    );

    return new Paginated(items.map(toClubResponse), total, page, limit);
  }

  async findAllSimple(
    context: ClubAccessContext,
  ): Promise<ClubSimpleResponseDto[]> {
    const clubs = await this.clubsRepository.findAllSimple(context);
    return clubs.map(toClubSimpleResponse);
  }

  async findOne(
    id: string,
    context: ClubAccessContext,
  ): Promise<ClubResponseDto> {
    return toClubResponse(await this.findEntityOrFail(id, context));
  }

  /** Opções para os seletores dos formulários. */
  async listOptions(
    context: ClubAccessContext,
  ): Promise<ClubSelectOptionDto[]> {
    return this.clubsRepository.list(context);
  }
}
