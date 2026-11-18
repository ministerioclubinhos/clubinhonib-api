import { Injectable } from '@nestjs/common';

import { AccessContext, UserRole } from 'src/core/auth/auth.types';
import { AppForbiddenException, ErrorCode } from 'src/shared/exceptions';

import { TeacherProfilesRepository } from '../repositories/teacher-profiles.repository';
import { TeacherProfileEntity } from '../entities/teacher-profile.entity/teacher-profile.entity';
import { assertCanAccessTeacherProfiles } from '../utils';

/** Vínculo entre professor e clubinho. */
@Injectable()
export class UpdateTeacherProfilesService {
  constructor(private readonly repo: TeacherProfilesRepository) {}

  /**
   * O administrador vincula qualquer clubinho; o coordenador, só os seus.
   */
  private async assertClubInScope(
    context: AccessContext,
    clubId: string,
    message: string,
  ): Promise<void> {
    if (context.role === UserRole.ADMIN) return;

    const allowed = await this.repo.userHasAccessToClub(clubId, context);
    if (!allowed) {
      throw new AppForbiddenException(ErrorCode.CLUB_ACCESS_DENIED, message);
    }
  }

  async assignClub(
    context: AccessContext,
    teacherId: string,
    clubId: string,
  ): Promise<void> {
    assertCanAccessTeacherProfiles(context);
    await this.assertClubInScope(
      context,
      clubId,
      'Sem acesso ao clubinho informado',
    );

    // A turma atual do professor não é verificada: um coordenador monta a
    // equipe do clubinho dele com qualquer professor, venha ele de onde vier.
    // Vincular move o vínculo, então o professor sai do clubinho anterior — e
    // o que limita a operação é o **destino**, checado acima: ninguém empurra
    // professor para o clubinho de outra coordenação.
    await this.repo.assignTeacherToClub(teacherId, clubId);
  }

  async unassignClub(
    context: AccessContext,
    teacherId: string,
    expectedClubId: string | undefined,
  ): Promise<void> {
    assertCanAccessTeacherProfiles(context);

    if (context.role !== UserRole.ADMIN) {
      // Sem o clubinho no corpo, o desvínculo vale para o clubinho atual do
      // professor — é ele que precisa estar sob a coordenação de quem pediu.
      const clubId =
        expectedClubId ??
        (
          await this.repo.findOneWithClubAndCoordinatorOrFail(
            teacherId,
            context,
          )
        ).club?.id;

      if (!clubId) {
        throw new AppForbiddenException(
          ErrorCode.PROFILE_INVALID_OPERATION,
          'Professor não possui clubinho para desvincular',
        );
      }

      await this.assertClubInScope(
        context,
        clubId,
        'Sem acesso ao clubinho informado',
      );
    }

    await this.repo.unassignTeacherFromClub(teacherId, expectedClubId);
  }

  /**
   * Acompanha a situação da conta, preservando o clubinho.
   *
   * Chamado pelo módulo de usuários quando `active` muda. O perfil continua
   * existindo e apontando para a mesma turma: quem sai de vez é removido pela
   * troca de papel ou pela exclusão da conta.
   */
  async setActiveForUser(userId: string, active: boolean): Promise<void> {
    await this.repo.setActiveByUserId(userId, active);
  }

  /**
   * O próprio professor entrando no clubinho pelo número.
   *
   * É outro caso de uso: não passa pela política administrativa e, uma vez
   * vinculado, o professor não troca de clubinho sozinho — quem move é a
   * administração, por `assignClub`.
   */
  async linkOwnClubByNumber(
    userId: string,
    clubNumber: number,
  ): Promise<TeacherProfileEntity> {
    return this.repo.linkTeacherToClubByNumber(userId, clubNumber);
  }
}
