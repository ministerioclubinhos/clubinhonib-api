import { Injectable } from '@nestjs/common';

import { CoordinatorProfilesRepository } from '../repositories/coordinator-profiles.repository';

/**
 * Remoção do perfil de coordenação.
 *
 * Não há rota: quem chama é o módulo de usuários quando o papel deixa de ser
 * coordenador ou quando o usuário é excluído.
 */
@Injectable()
export class DeleteCoordinatorProfilesService {
  constructor(private readonly repo: CoordinatorProfilesRepository) {}

  async removeByUserId(userId: string): Promise<void> {
    await this.repo.removeByUserId(userId);
  }
}
