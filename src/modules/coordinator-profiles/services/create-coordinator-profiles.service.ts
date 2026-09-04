import { Injectable } from '@nestjs/common';

import { CoordinatorProfilesRepository } from '../repositories/coordinator-profiles.repository';
import { CoordinatorProfileEntity } from '../entities/coordinator-profile.entity/coordinator-profile.entity';

/**
 * Criação do perfil de coordenação.
 *
 * Não há rota: o perfil nasce junto com o usuário, e quem chama é o módulo de
 * usuários quando o papel passa a ser coordenador.
 */
@Injectable()
export class CreateCoordinatorProfilesService {
  constructor(private readonly repo: CoordinatorProfilesRepository) {}

  async createForUser(userId: string): Promise<CoordinatorProfileEntity> {
    return this.repo.createForUser(userId);
  }
}
