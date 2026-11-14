import { Injectable } from '@nestjs/common';

import { PersonalDataRepository } from '../../repositories/personal-data.repository';
import { UserPreferencesRepository } from '../../repositories/user-preferences.repository';
import { PersonalData } from '../../entities/personal-data.entity';
import { UserPreferences } from '../../entities/user-preferences.entity';

/**
 * Leitura crua dos dois blocos de perfil de um usuário.
 *
 * Mora num serviço próprio, e não em `GetOneProfileService`, porque quem o
 * consome é o módulo `user` — e `GetOneProfileService` consome o `user` de
 * volta. Separando, o ciclo fica só entre os módulos (resolvido com
 * `forwardRef` nos dois lados) e nunca entre os arquivos, onde uma das classes
 * chegaria `undefined` na hora de resolver a injeção.
 */
@Injectable()
export class GetProfileBlocksService {
  constructor(
    private readonly personalDataRepository: PersonalDataRepository,
    private readonly userPreferencesRepository: UserPreferencesRepository,
  ) {}

  /**
   * Os blocos como estão gravados.
   *
   * Ausência é resultado normal: quem nunca preencheu o perfil não tem linha.
   */
  async findByUserId(userId: string): Promise<{
    personalData: PersonalData | null;
    preferences: UserPreferences | null;
  }> {
    const [personalData, preferences] = await Promise.all([
      this.personalDataRepository.findByUserId(userId),
      this.userPreferencesRepository.findByUserId(userId),
    ]);

    return { personalData, preferences };
  }
}
