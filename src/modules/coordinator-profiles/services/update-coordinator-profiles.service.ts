import { Injectable } from '@nestjs/common';

import { AccessContext } from 'src/core/auth/auth.types';

import { CoordinatorProfilesRepository } from '../repositories/coordinator-profiles.repository';
import { assertCanManageCoordinatorProfiles } from '../utils';

/** Vínculo entre clubinho e coordenador. */
@Injectable()
export class UpdateCoordinatorProfilesService {
  constructor(private readonly repo: CoordinatorProfilesRepository) {}

  async assignClub(
    context: AccessContext,
    coordinatorId: string,
    clubId: string,
  ): Promise<void> {
    assertCanManageCoordinatorProfiles(context);

    await this.repo.assignClubToCoordinator(coordinatorId, clubId);
  }

  async unassignClub(
    context: AccessContext,
    coordinatorId: string,
    clubId: string,
  ): Promise<void> {
    assertCanManageCoordinatorProfiles(context);

    await this.repo.unassignClubFromCoordinator(coordinatorId, clubId);
  }

  async moveClub(
    context: AccessContext,
    fromCoordinatorId: string,
    clubId: string,
    toCoordinatorId: string,
  ): Promise<void> {
    assertCanManageCoordinatorProfiles(context);

    await this.repo.moveClubBetweenCoordinators(
      fromCoordinatorId,
      clubId,
      toCoordinatorId,
    );
  }

  /**
   * Acompanha a situação da conta, preservando os clubinhos.
   *
   * Chamado pelo módulo de usuários quando `active` muda. O perfil continua
   * existindo e coordenando as mesmas turmas: quem sai de vez é removido pela
   * troca de papel ou pela exclusão da conta.
   */
  async setActiveForUser(userId: string, active: boolean): Promise<void> {
    await this.repo.setActiveByUserId(userId, active);
  }
}
