import { Injectable, UnauthorizedException, Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcryptjs';
import { AuthRepository } from './auth.repository';
import { LoginDto } from './dto/login.dto';
import { UserService } from 'src/user/user.service';
import { User } from 'src/user/user.entity';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly authRepo: AuthRepository,
    private readonly jwtService: JwtService,
    private readonly config: ConfigService,
    private readonly userService: UserService,
  ) {}

  private generateTokens(userId: string, email: string): { accessToken: string; refreshToken: string } {
    const payload = { sub: userId, email };
    const accessToken = this.jwtService.sign(payload);
    const refreshToken = this.jwtService.sign(payload, {
      secret: this.config.get<string>('JWT_REFRESH_SECRET'),
      expiresIn: this.config.get<string>('JWT_REFRESH_EXPIRES_IN'),
    });
    return { accessToken, refreshToken };
  }

  async login(dto: LoginDto) {
    this.logger.debug(`Tentando login para o email: ${dto.email}`);

    const user = await this.authRepo.validateUser(dto.email, dto.password);
    if (!user) {
      this.logger.warn(`Usuário não encontrado para o email: ${dto.email}`);
      throw new UnauthorizedException('Invalid credentials');
    }

    const isPasswordValid = await bcrypt.compare(dto.password, user.password);
    if (!isPasswordValid) {
      this.logger.warn(`Senha inválida para o email: ${dto.email}`);
      throw new UnauthorizedException('Invalid credentials');
    }

    const { accessToken, refreshToken } = this.generateTokens(user.id, user.email);
    await this.userService.updateRefreshToken(user.id, refreshToken);

    this.logger.log(`Login bem-sucedido para o email: ${dto.email}`);
    return {
      message: 'Login successful',
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
      },
      accessToken,
      refreshToken,
    };
  }

  async refreshToken(refreshToken: string) {
    if (!refreshToken) {
      this.logger.warn('Refresh token não fornecido');
      throw new UnauthorizedException('Refresh token is required');
    }

    try {
      this.logger.debug('Tentando refresh token');
      const payload = this.jwtService.verify(refreshToken, {
        secret: this.config.get<string>('JWT_REFRESH_SECRET'),
      });

      const user = await this.userService.findOne(payload.sub);
      if (!user || user.refreshToken !== refreshToken) {
        this.logger.warn(`Refresh token inválido para o usuário ID: ${payload.sub}`);
        throw new UnauthorizedException('Invalid refresh token');
      }

      const { accessToken, refreshToken: newRefreshToken } = this.generateTokens(user.id, user.email);
      await this.userService.updateRefreshToken(user.id, newRefreshToken);

      this.logger.log(`Refresh token bem-sucedido para o usuário ID: ${user.id}`);
      return {
        accessToken,
        refreshToken: newRefreshToken,
      };
    } catch (e) {
      this.logger.error('Erro ao tentar refresh token', e.stack);
      throw new UnauthorizedException('Invalid refresh token');
    }
  }

  async logout(userId: string) {
    this.logger.debug(`Logout para o usuário ID: ${userId}`);
    await this.userService.updateRefreshToken(userId, null);
    this.logger.log(`Logout bem-sucedido para o usuário ID: ${userId}`);
    return { message: 'User logged out' };
  }

  async getMe(userId: string): Promise<Partial<User>> {
    this.logger.debug(`Buscando dados do usuário para ID: ${userId}`);
    const user = await this.userService.findOne(userId);
    if (!user) {
      this.logger.warn(`Usuário não encontrado para ID: ${userId}`);
      throw new UnauthorizedException('User not found');
    }

    return {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
    };
  }
}
