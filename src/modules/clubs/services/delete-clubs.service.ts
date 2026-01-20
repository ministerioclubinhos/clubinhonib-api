import { Injectable } from '@nestjs/common';
import { Request } from 'express';
import { ClubsRepository } from '../repositories/clubs.repository';
import { AuthContextService } from 'src/core/auth/services/auth-context.service';
import {
  AppNotFoundException,
  AppForbiddenException,
  ErrorCode,
} from 'src/shared/exceptions';

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
      throw new AppForbiddenException(ErrorCode.CLUB_ACCESS_DENIED, 'Acesso negado');
    }

    if (ctx.role === 'coordinator') {
      const allowed = await this.clubsRepository.userHasAccessToClub(id, ctx);
      if (!allowed) throw new AppNotFoundException(ErrorCode.CLUB_NOT_FOUND, 'Clubinho não encontrado');
    }

    await this.clubsRepository.deleteById(id);
    return { message: 'Clubinho removido com sucesso' };
  }
}
