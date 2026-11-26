import { Injectable } from '@nestjs/common';

import { TeacherProfilesRepository } from '../repositories/teacher-profiles.repository';
import { TeacherProfileEntity } from '../entities/teacher-profile.entity/teacher-profile.entity';

/**
 * Criação do perfil de professor.
 *
 * Não há rota: o perfil nasce junto com o usuário, e quem chama é o módulo de
 * usuários quando o papel passa a ser professor.
 */
@Injectable()
export class CreateTeacherProfilesService {
  constructor(private readonly repo: TeacherProfilesRepository) {}

  async createForUser(userId: string): Promise<TeacherProfileEntity> {
    return this.repo.createForUser(userId);
  }
}
