import { Injectable } from '@nestjs/common';
import { Request } from 'express';
import { ClubsRepository } from '../repositories/clubs.repository';
import {
  AppNotFoundException,
  AppForbiddenException,
  ErrorCode,
} from 'src/shared/exceptions';
import { QueryClubsDto } from '../dto/query-clubs.dto';
import {
  ClubResponseDto,
  ClubSimpleResponseDto,
  toClubDto,
  toClubSimpleDto,
} from '../dto/club.response.dto';
import { Paginated } from 'src/shared/dto/paginated.dto';
import { ClubSelectOptionDto } from '../dto/club-select-option.dto';
import { AuthContextService } from 'src/core/auth/services/auth-context.service';

type Ctx = { role?: string; userId?: string | null };

@Injectable()
export class GetClubsService {
  constructor(
    private readonly clubsRepository: ClubsRepository,
    private readonly authCtx: AuthContextService,
  ) {}

  private async getCtx(req: Request): Promise<Ctx> {
    const p = await this.authCtx.tryGetPayload(req);
    return { role: p?.role?.toLowerCase(), userId: p?.sub ?? null };
  }

  async findAllPaginated(q: QueryClubsDto, req: Request): Promise<Paginated<ClubResponseDto>> {
    const ctx = await this.getCtx(req);
    if (!ctx.role || ctx.role === 'teacher') throw new AppForbiddenException(ErrorCode.CLUB_ACCESS_DENIED, 'Acesso negado');

    const { page = 1, limit = 10 } = q;
    const { items, total } = await this.clubsRepository.findAllPaginated(q, ctx);

    return new Paginated(items.map(toClubDto), total, page, limit);
  }

  async findAllSimple(req: Request): Promise<ClubSimpleResponseDto[]> {
    const ctx = await this.getCtx(req);
    const clubs = await this.clubsRepository.findAllSimple(ctx);
    return clubs.map(toClubSimpleDto);
  }

  async findOne(id: string, req: Request): Promise<ClubResponseDto> {
    const ctx = await this.getCtx(req);
    const club = await this.clubsRepository.findOneOrFailForResponse(id, ctx);
    if (!club) throw new AppNotFoundException(ErrorCode.CLUB_NOT_FOUND, 'Clubinho não encontrado');
    return toClubDto(club);
  }

  async list(req: Request): Promise<ClubSelectOptionDto[]> {
    const ctx = await this.getCtx(req);
    return await this.clubsRepository.list(ctx);
  }


  async toggleActive(id: string, req: Request): Promise<ClubResponseDto> {
    const ctx = await this.getCtx(req);
    if (!ctx.role || ctx.role === 'teacher') throw new AppForbiddenException(ErrorCode.CLUB_ACCESS_DENIED, 'Acesso negado');

    const club = await this.clubsRepository.findOneOrFailForResponse(id, ctx);
    if (!club) throw new AppNotFoundException(ErrorCode.CLUB_NOT_FOUND, 'Clubinho não encontrado ou sem acesso');

    const updateDto = { isActive: !club.isActive };
    await this.clubsRepository.updateClub(id, updateDto);

    const reloaded = await this.clubsRepository.findOneOrFailForResponse(id, ctx);
    if (!reloaded) throw new AppNotFoundException(ErrorCode.CLUB_NOT_FOUND, 'Clubinho não encontrado');
    return toClubDto(reloaded);
  }
}
