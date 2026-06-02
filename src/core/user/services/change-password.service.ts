import { Injectable, Logger } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { UserRepository } from '../user.repository';
import { ChangePasswordDto } from '../dto/change-password.dto';
import {
  AppNotFoundException,
  AppUnauthorizedException,
  AppBusinessException,
  ErrorCode,
} from 'src/shared/exceptions';

@Injectable()
export class ChangePasswordService {
  private readonly logger = new Logger(ChangePasswordService.name);

  constructor(private readonly userRepo: UserRepository) {}

  async changePassword(
    userId: string,
    dto: ChangePasswordDto,
  ): Promise<{ message: string }> {
    const user = await this.userRepo.findById(userId);
    if (!user) {
      throw new AppNotFoundException(
        ErrorCode.USER_NOT_FOUND,
        'Usuário não encontrado',
      );
    }

    if (user.commonUser) {
      if (!dto.currentPassword) {
        throw new AppBusinessException(
          ErrorCode.VALIDATION_ERROR,
          'A senha atual é obrigatória para usuários comuns',
        );
      }

      const isPasswordValid = await bcrypt.compare(
        dto.currentPassword,
        user.password,
      );
      if (!isPasswordValid) {
        throw new AppUnauthorizedException(
          ErrorCode.PASSWORD_MISMATCH,
          'Senha atual incorreta',
        );
      }
    }

    if (user.password) {
      const isSamePassword = await bcrypt.compare(
        dto.newPassword,
        user.password,
      );
      if (isSamePassword) {
        throw new AppBusinessException(
          ErrorCode.PASSWORD_SAME_AS_CURRENT,
          'A nova senha deve ser diferente da senha atual',
        );
      }
    }

    const hashedNewPassword = await bcrypt.hash(dto.newPassword, 10);

    await this.userRepo.update(userId, { password: hashedNewPassword });

    this.logger.log(
      `Senha alterada para o usuário: ${userId} (commonUser: ${user.commonUser})`,
    );

    return { message: 'Senha alterada com sucesso' };
  }
}
