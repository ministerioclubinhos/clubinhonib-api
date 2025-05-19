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
    private readonly configService: ConfigService,
    private readonly userService: UserService,
  ) {}

  private generateTokens(user: User) {
    const payload = { sub: user.id, email: user.email, role: user.role };

    const accessToken = this.jwtService.sign(payload);

    const refreshToken = this.jwtService.sign(payload, {
      secret: this.configService.getOrThrow<string>('JWT_REFRESH_SECRET'),
      expiresIn: this.configService.getOrThrow<string>('JWT_REFRESH_EXPIRES_IN'),
    });

    return { accessToken, refreshToken };
  }

  async login({ email, password }: LoginDto) {
    this.logger.debug(`🔐 Tentando login para: ${email}`);

    const user = await this.authRepo.validateUser(email, password);
    if (!user) {
      this.logger.warn(`❗ Usuário não encontrado: ${email}`);
      throw new UnauthorizedException('Invalid credentials');
    }

    const passwordValid = await bcrypt.compare(password, user.password);
    if (!passwordValid) {
      this.logger.warn(`❗ Senha inválida para: ${email}`);
      throw new UnauthorizedException('Invalid credentials');
    }

    const { accessToken, refreshToken } = this.generateTokens(user);
    await this.userService.updateRefreshToken(user.id, refreshToken);

    this.logger.log(`✅ Login bem-sucedido: ${email}`);

    return {
      message: 'Login successful',
      user: this.buildUserResponse(user),
      accessToken,
      refreshToken,
    };
  }

  async refreshToken(token: string) {
    if (!token) {
      this.logger.warn('❗ Refresh token não fornecido');
      throw new UnauthorizedException('Refresh token is required');
    }

    try {
      this.logger.debug('🔄 Tentando refresh token');

      const payload = this.jwtService.verify(token, {
        secret: this.configService.getOrThrow<string>('JWT_REFRESH_SECRET'),
      });

      const user = await this.userService.findOne(payload.sub);
      if (!user || user.refreshToken !== token) {
        this.logger.warn(`❗ Refresh token inválido para user ID: ${payload.sub}`);
        throw new UnauthorizedException('Invalid refresh token');
      }

      const { accessToken, refreshToken: newRefreshToken } = this.generateTokens(user);
      await this.userService.updateRefreshToken(user.id, newRefreshToken);

      this.logger.log(`✅ Refresh token renovado para user ID: ${user.id}`);

      return { accessToken, refreshToken: newRefreshToken };
    } catch (error) {
      this.logger.error('❌ Erro ao renovar refresh token', error.stack);
      throw new UnauthorizedException('Invalid refresh token');
    }
  }

  async logout(userId: string) {
    this.logger.debug(`🚪 Logout para user ID: ${userId}`);
    await this.userService.updateRefreshToken(userId, null);
    this.logger.log(`✅ Logout concluído para user ID: ${userId}`);
    return { message: 'User logged out' };
  }

  async getMe(userId: string): Promise<Partial<User>> {
    this.logger.debug(`🔎 Buscando dados do user ID: ${userId}`);

    const user = await this.userService.findOne(userId);
    if (!user) {
      this.logger.warn(`❗ Usuário não encontrado: ${userId}`);
      throw new UnauthorizedException('User not found');
    }

    return this.buildUserResponse(user);
  }

  private buildUserResponse(user: User): Partial<User> {
    return {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
    };
  }
}
