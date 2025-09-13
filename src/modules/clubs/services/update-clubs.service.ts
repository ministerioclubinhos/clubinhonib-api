import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Request } from 'express';
import { ClubsRepository } from '../repositories/clubs.repository';
import { UpdateClubDto } from '../dto/update-club.dto';
import { AuthContextService } from 'src/auth/services/auth-context.service';

type Ctx = { role?: string; userId?: string | null };

@Injectable()
export class UpdateClubsService {
  constructor(
    private readonly clubsRepository: ClubsRepository,
    private readonly authCtx: AuthContextService,
  ) { }

  private async getCtx(req: Request): Promise<Ctx> {
    const p = await this.authCtx.tryGetPayload(req);
    return { role: p?.role?.toLowerCase(), userId: p?.sub ?? null };
  }

  async update(id: string, dto: UpdateClubDto, req: Request) {
    const ctx = await this.getCtx(req);
    if (!ctx.role || ctx.role === 'teacher') throw new ForbiddenException('Acesso negado');

    if (ctx.role === 'coordinator') {
      const allowed = await this.clubsRepository.userHasAccessToClub(id, ctx);
      if (!allowed) throw new NotFoundException('Club não encontrado');

      if (dto.coordinatorProfileId !== undefined) {
        const myCoordId = await this.clubsRepository.getCoordinatorProfileIdByUserId(ctx.userId!);
        if (!myCoordId) throw new ForbiddenException('Acesso negado');
        if (dto.coordinatorProfileId !== null && dto.coordinatorProfileId !== myCoordId) {
          throw new ForbiddenException('Não é permitido atribuir outro coordenador');
        }
        if (dto.coordinatorProfileId === undefined) {
          dto.coordinatorProfileId = myCoordId;
        }
      }
    }

    return this.clubsRepository.updateClub(id, dto);
  }
}
