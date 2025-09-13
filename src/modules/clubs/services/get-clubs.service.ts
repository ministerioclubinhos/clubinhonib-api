import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { Request } from 'express';
import { ClubsRepository } from '../repositories/clubs.repository';
import { QueryClubsDto } from '../dto/query-clubs.dto';
import {
  ClubResponseDto,
  ClubSimpleResponseDto,
  toClubDto,
  toClubSimpleDto,
} from '../dto/club.response.dto';
import { Paginated } from 'src/share/dto/paginated.dto';
import { ClubSelectOptionDto } from '../dto/club-select-option.dto';
import { AuthContextService } from 'src/auth/services/auth-context.service';

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
    if (!ctx.role || ctx.role === 'teacher') throw new ForbiddenException('Acesso negado');

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
    if (!club) throw new NotFoundException('Club não encontrado');
    return toClubDto(club);
  }

  async list(req: Request): Promise<ClubSelectOptionDto[]> {
    const ctx = await this.getCtx(req);
    return await this.clubsRepository.list(ctx);
  }
}
