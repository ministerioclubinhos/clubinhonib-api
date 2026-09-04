import { Injectable } from '@nestjs/common';

import { TeacherProfilesRepository } from '../repositories/teacher-profiles.repository';

/**
 * Remoção do perfil de professor.
 *
 * Não há rota: quem chama é o módulo de usuários quando o papel deixa de ser
 * professor ou quando o usuário é excluído.
 */
@Injectable()
export class DeleteTeacherProfilesService {
  constructor(private readonly repo: TeacherProfilesRepository) {}

  async removeByUserId(userId: string): Promise<void> {
    await this.repo.removeByUserId(userId);
  }
}
