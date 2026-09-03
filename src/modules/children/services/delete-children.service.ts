import { Injectable } from '@nestjs/common';
import { Request } from 'express';

import { ChildrenRepository } from '../repositories/children.repository';
import {
  AppNotFoundException,
  ErrorCode,
} from 'src/shared/exceptions';
import { AuthContextService } from 'src/core/auth/services/auth-context.service';

type AccessCtx = { role?: string; userId?: string | null };

@Injectable()
export class DeleteChildrenService {
  constructor(
    private readonly childrenRepo: ChildrenRepository,
    private readonly authContextService: AuthContextService,
  ) {}

  private async getCtx(request: Request): Promise<AccessCtx> {
    const payload = await this.authContextService.tryGetPayload(request);
    return {
      role: payload?.role?.toString().toLowerCase(),
      userId: payload?.sub ?? null,
    };
  }

  async remove(id: string, request: Request): Promise<void> {
    const ctx = await this.getCtx(request);
    const entity = await this.childrenRepo.findOneForResponse(id, ctx);
    if (!entity) {
      throw new AppNotFoundException(
        ErrorCode.CHILD_NOT_FOUND,
        'Criança não encontrada ou sem acesso',
      );
    }
    await this.childrenRepo.delete(id);
  }
}
