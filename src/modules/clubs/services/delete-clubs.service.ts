import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Request } from 'express';
import { ClubsRepository } from '../repositories/clubs.repository';
import { AuthContextService } from 'src/auth/services/auth-context.service';

type Ctx = { role?: string; userId?: string | null };

@Injectable()
export class DeleteClubsService {
  constructor(
    private readonly clubsRepository: ClubsRepository,
    private readonly authCtx: AuthContextService,
  ) {}

  private async getCtx(req: Request): Promise<Ctx> {
    const p = await this.authCtx.tryGetPayload(req);
    return { role: p?.role?.toLowerCase(), userId: p?.sub ?? null };
  }

  async remove(id: string, req: Request): Promise<{ message: string }> {
    const ctx = await this.getCtx(req);
    if (!ctx.role || ctx.role === 'teacher') {
      throw new ForbiddenException('Acesso negado');
    }

    if (ctx.role === 'coordinator') {
      const allowed = await this.clubsRepository.userHasAccessToClub(id, ctx);
      if (!allowed) throw new NotFoundException('Club não encontrado');
    }

    await this.clubsRepository.deleteById(id);
    return { message: 'Club removido com sucesso' };
  }
}
