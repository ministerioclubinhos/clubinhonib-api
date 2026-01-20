import { Injectable, Logger } from '@nestjs/common';
import { UserRepository } from '../user.repository';
import { UpdateOwnProfileDto } from '../dto/update-own-profile.dto';
import { UserEntity } from '../entities/user.entity';
import {
  AppNotFoundException,
  AppConflictException,
  ErrorCode,
} from 'src/shared/exceptions';

@Injectable()
export class UpdateOwnProfileService {
  private readonly logger = new Logger(UpdateOwnProfileService.name);

  constructor(private readonly userRepo: UserRepository) { }

  async updateOwnProfile(
    userId: string,
    dto: UpdateOwnProfileDto,
  ): Promise<UserEntity> {
    const currentUser = await this.userRepo.findById(userId);
    if (!currentUser) {
      throw new AppNotFoundException(
        ErrorCode.USER_NOT_FOUND,
        'Usuário não encontrado',
      );
    }

    if (dto.email && dto.email !== currentUser.email) {
      const existingUser = await this.userRepo.findByEmail(dto.email);
      if (existingUser && existingUser.id !== userId) {
        throw new AppConflictException(
          ErrorCode.EMAIL_ALREADY_IN_USE,
          'Este email já está em uso por outro usuário',
          { field: 'email' },
        );
      }
    }

    if (dto.cpf && dto.cpf !== currentUser.cpf) {
      const existingUser = await this.userRepo.findByCpf(dto.cpf);
      if (existingUser && existingUser.id !== userId) {
        throw new AppConflictException(
          ErrorCode.RESOURCE_CONFLICT,
          'Este CPF já está em uso por outro usuário',
          { field: 'cpf' },
        );
      }
    }

    const updateData: Partial<UserEntity> = {};
    if (dto.name !== undefined) updateData.name = dto.name;
    if (dto.email !== undefined) updateData.email = dto.email;
    if (dto.phone !== undefined) updateData.phone = dto.phone;
    if (dto.cpf !== undefined) updateData.cpf = dto.cpf;

    if (Object.keys(updateData).length === 0) {
      return currentUser;
    }

    const updatedUser = await this.userRepo.update(userId, updateData);

    this.logger.log(`Perfil atualizado para o usuário: ${userId}`);

    return updatedUser;
  }
}
