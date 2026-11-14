import { Injectable } from '@nestjs/common';
import { Request } from 'express';

import { ChildrenRepository } from '../repositories/children.repository';
import { AppNotFoundException, ErrorCode } from 'src/shared/exceptions';
import { AuthContextService } from 'src/core/auth/services/auth-context.service';
import { assertCanDeleteChild } from '../utils';

@Injectable()
export class DeleteChildrenService {
  constructor(
    private readonly childrenRepo: ChildrenRepository,
    private readonly authContextService: AuthContextService,
  ) {}

  async remove(id: string, request: Request): Promise<void> {
    const ctx = await this.authContextService.resolveAccessContext(request);

    // Antes de procurar a criança: quem não pode excluir não precisa nem saber
    // se ela existe, e a checagem de papel não depende de consulta ao banco.
    assertCanDeleteChild(ctx);

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
