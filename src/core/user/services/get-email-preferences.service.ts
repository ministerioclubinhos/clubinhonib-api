import { Injectable } from '@nestjs/common';

import { AppNotFoundException, ErrorCode } from 'src/shared/exceptions';

import { MyEmailPreferencesResponseDto } from '../dto/my-email-preferences.dto';
import { UserRepository } from '../user.repository';
import { toMyEmailPreferences } from '../utils';

/** Leitura da preferência de e-mail da própria pessoa, nas configurações. */
@Injectable()
export class GetEmailPreferencesService {
  constructor(private readonly userRepo: UserRepository) {}

  async findMine(userId: string): Promise<MyEmailPreferencesResponseDto> {
    const user = await this.userRepo.findById(userId);
    if (!user) {
      throw new AppNotFoundException(
        ErrorCode.USER_NOT_FOUND,
        'Usuário não encontrado.',
      );
    }
    return toMyEmailPreferences(user.noticesUnsubscribedAt);
  }
}
