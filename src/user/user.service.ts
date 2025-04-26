import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { UserRepository } from './user.repository';
import { CreateUserDto } from './dto/create-user.dto';
import * as bcrypt from 'bcryptjs';
import { User } from './user.entity';

@Injectable()
export class UserService {
  private readonly logger = new Logger(UserService.name);

  constructor(private readonly userRepo: UserRepository) {}

  async create(dto: CreateUserDto): Promise<User> {
    this.logger.debug(`Criando usuário com email: ${dto.email}`);
    try {
      const hashedPassword = await bcrypt.hash(dto.password, 10);
      const user = await this.userRepo.create({ ...dto, password: hashedPassword });
      this.logger.log(`Usuário criado com sucesso: ${user.id}`);
      return user;
    } catch (error) {
      this.logger.error(`Erro ao criar usuário: ${error.message}`, error.stack);
      throw error;
    }
  }

  async findAll(): Promise<User[]> {
    this.logger.debug('Buscando todos os usuários');
    return this.userRepo.findAll();
  }

  async findOne(id: string): Promise<User> {
    this.logger.debug(`Buscando usuário com ID: ${id}`);
    const user = await this.userRepo.findById(id);
    if (!user) {
      this.logger.warn(`Usuário não encontrado com ID: ${id}`);
      throw new NotFoundException('User not found');
    }
    return user;
  }

  async update(id: string, dto: Partial<CreateUserDto>): Promise<User> {
    this.logger.debug(`Atualizando usuário com ID: ${id}`);
    if (dto.password) {
      dto.password = await bcrypt.hash(dto.password, 10);
    }
    const user = await this.userRepo.update(id, dto);
    this.logger.log(`Usuário atualizado com sucesso: ${id}`);
    return user;
  }

  async remove(id: string): Promise<{ message: string }> {
    this.logger.debug(`Removendo usuário com ID: ${id}`);
    await this.userRepo.delete(id);
    this.logger.log(`Usuário removido com sucesso: ${id}`);
    return { message: 'User deleted' };
  }

  async findByEmail(email: string): Promise<User | null> {
    this.logger.debug(`Buscando usuário com email: ${email}`);
    return this.userRepo.findByEmail(email);
  }

  async updateRefreshToken(userId: string, token: string | null): Promise<void> {
    this.logger.debug(`Atualizando refresh token para o usuário ID: ${userId}`);
    await this.userRepo.updateRefreshToken(userId, token);
  }
}
