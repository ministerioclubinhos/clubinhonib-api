import { ForbiddenException, Injectable } from '@nestjs/common';
import { Request } from 'express';
import { ClubsRepository } from '../repositories/clubs.repository';
import { CreateClubDto } from '../dto/create-club.dto';
import { AuthContextService } from 'src/auth/services/auth-context.service';

type Ctx = { role?: string; userId?: string | null };

@Injectable()
export class CreateClubsService {
  constructor(
    private readonly clubsRepository: ClubsRepository,
    private readonly authCtx: AuthContextService,
  ) { }

  private async getCtx(req: Request): Promise<Ctx> {
    const p = await this.authCtx.tryGetPayload(req);
    return { role: p?.role?.toLowerCase(), userId: p?.sub ?? null };
  }

  async create(dto: CreateClubDto, req: Request) {
    const ctx = await this.getCtx(req);
    if (!ctx.role || ctx.role === 'teacher') {
      throw new ForbiddenException('Acesso negado');
    }

    if (ctx.role === 'coordinator') {
      const myCoordId = await this.clubsRepository.getCoordinatorProfileIdByUserId(ctx.userId!);
      if (!myCoordId) throw new ForbiddenException('Acesso negado');

      if (dto.coordinatorProfileId && dto.coordinatorProfileId !== myCoordId) {
        throw new ForbiddenException('Não é permitido atribuir outro coordenador');
      }
      dto.coordinatorProfileId = myCoordId;
    }

    return this.clubsRepository.createClub(dto);
  }
}
