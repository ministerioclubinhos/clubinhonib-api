import { Injectable } from '@nestjs/common';
import { Request } from 'express';

import { ChildrenRepository } from '../repositories/children.repository';
import { AppNotFoundException, ErrorCode } from 'src/shared/exceptions';
import { AuthContextService } from 'src/core/auth/services/auth-context.service';

@Injectable()
export class DeleteChildrenService {
  constructor(
    private readonly childrenRepo: ChildrenRepository,
    private readonly authContextService: AuthContextService,
  ) {}

  async remove(id: string, request: Request): Promise<void> {
    const ctx = await this.authContextService.resolveAccessContext(request);
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
