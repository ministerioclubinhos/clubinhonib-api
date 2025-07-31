import { Injectable, UnauthorizedException, Logger, NotFoundException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcryptjs';
import { AuthRepository } from './auth.repository';
import { LoginDto } from './dto/login.dto';
import { UserService } from 'src/user/user.service';
import { User, UserRole } from 'src/user/user.entity';
import { OAuth2Client } from 'google-auth-library';
import { CompleteUserDto } from './dto/complete-register.dto';
import { RegisterUserDto } from './dto/register.dto';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);
  private readonly googleClient: OAuth2Client;

  constructor(
    private readonly authRepo: AuthRepository,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly userService: UserService,
  ) {
    this.googleClient = new OAuth2Client(
      configService.getOrThrow<string>('GOOGLE_CLIENT_ID'),
    );
    this.logger.log('AuthService inicializado (Google OAuth habilitado)');
  }

  private generateTokens(user: User) {
    this.logger.debug(`Gerando tokens para userId=${user.id}`);
    const payload = { sub: user.id, email: user.email, role: user.role };

    const accessToken = this.jwtService.sign(payload);
    const refreshToken = this.jwtService.sign(payload, {
      secret: this.configService.getOrThrow<string>('JWT_REFRESH_SECRET'),
      expiresIn: this.configService.getOrThrow<string>('JWT_REFRESH_EXPIRES_IN'),
    });

    return { accessToken, refreshToken };
  }

  async login({ email, password }: LoginDto) {
    this.logger.debug(`Tentativa de login: ${email}`);

    const user = await this.authRepo.validateUser(email, password);
    if (!user || !(await bcrypt.compare(password, user.password))) {
      this.logger.warn(`Credenciais inválidas: ${email}`);
      throw new UnauthorizedException('Invalid credentials');
    }

    const tokens = this.generateTokens(user);
    await this.userService.updateRefreshToken(user.id, tokens.refreshToken);

    this.logger.log(`Login bem-sucedido para: ${email}`);
    return {
      message: 'Login successful',
      user: this.buildUserResponse(user),
      ...tokens,
    };
  }

  async googleLogin(token: string) {
    this.logger.debug('Iniciando login via Google');

    try {
      const ticket = await this.googleClient.verifyIdToken({
        idToken: token,
        audience: this.configService.getOrThrow<string>('GOOGLE_CLIENT_ID'),
      });

      const payload = ticket.getPayload();
      if (!payload?.email || !payload?.name) {
        this.logger.error('Payload do Google inválido');
        throw new UnauthorizedException('Invalid Google token payload');
      }

      const { email, name } = payload;
      let user = await this.userService.findByEmail(email);

      if (!user) {
        this.logger.log(`Criando novo usuário Google: ${email}`);
        user = await this.userService.create({
          email,
          name,
          password: '',
          phone: '',
          commonUser: false,
          role: UserRole.USER,
        });

        return { email, name, completed: user.completed, commonUser: user.commonUser, newUser: true };
      }

      if (!user.completed) {
        this.logger.log(`Usuário Google existente sem cadastro completo: ${email}`);
        return { email, name, completed: false, commonUser: user.commonUser, newUser: true };
      }

      if (!(user as any).active) {
        this.logger.warn(`Usuário Google inativo: ${email}`);
        return { message: 'User is inactive', active: false, completed: user.completed, commonUser: user.commonUser, newUser: false };
      }

      const tokens = this.generateTokens(user);
      await this.userService.updateRefreshToken(user.id, tokens.refreshToken);

      this.logger.log(`Login Google bem-sucedido: ${email}`);
      return { message: 'Login successful', isNewUser: false, user: this.buildUserResponse(user), ...tokens };
    } catch (error) {
      this.logger.error(`Erro durante login Google: ${error.message}`);
      throw new UnauthorizedException('Invalid Google token');
    }
  }

  async refreshToken(token: string) {
    this.logger.debug('Renovando refresh token');

    if (!token) {
      this.logger.warn('Refresh token não fornecido');
      throw new UnauthorizedException('Refresh token is required');
    }

    try {
      const payload = this.jwtService.verify(token, {
        secret: this.configService.getOrThrow<string>('JWT_REFRESH_SECRET'),
      });

      const user = await this.userService.findOne(payload.sub);
      if (!user || user.refreshToken !== token) {
        this.logger.warn(`Refresh token inválido para userId=${payload.sub}`);
        throw new UnauthorizedException('Invalid refresh token');
      }

      const tokens = this.generateTokens(user);
      await this.userService.updateRefreshToken(user.id, tokens.refreshToken);

      this.logger.log(`Refresh token renovado para userId=${user.id}`);
      return tokens;
    } catch (error) {
      this.logger.error(`Erro ao renovar refresh token: ${error.message}`);
      throw new UnauthorizedException('Invalid refresh token');
    }
  }

  async logout(userId: string) {
    this.logger.debug(`Logout solicitado para userId=${userId}`);
    await this.userService.updateRefreshToken(userId, null);
    this.logger.log(`Logout concluído para userId=${userId}`);
    return { message: 'User logged out' };
  }

  async getMe(userId: string): Promise<Partial<User>> {
    this.logger.debug(`Buscando dados do usuário: ${userId}`);

    const user = await this.userService.findOne(userId);
    if (!user) {
      this.logger.warn(`Usuário não encontrado: ${userId}`);
      throw new UnauthorizedException('User not found');
    }

    return this.buildUserResponse(user);
  }

  async completeRegister(data: CompleteUserDto) {
    this.logger.debug(`Completar cadastro para: ${data.email}`);

    const user = await this.userService.findByEmail(data.email);
    if (!user) {
      this.logger.warn(`Usuário não encontrado no completeRegister: ${data.email}`);
      throw new NotFoundException('User not found');
    }

    if (user.completed) {
      this.logger.warn(`Usuário já completou cadastro: ${data.email}`);
      throw new NotFoundException('User already completed registration');
    }

    await this.userService.update(user.id, {
      name: data.name,
      phone: data.phone,
      password: data.password,
      completed: true,
    });

    this.logger.log(`Cadastro completado para: ${data.email}`);
    return { message: 'Registration completed successfully' };
  }

  async register(data: RegisterUserDto) {
    this.logger.debug(`Iniciando registro para: ${data.email}`);

    const existingUser = await this.userService.findByEmail(data.email);
    if (existingUser) {
      this.logger.warn(`Tentativa de registrar email já existente: ${data.email}`);
      throw new UnauthorizedException('User already exists');
    }

    const user = await this.userService.create({
      email: data.email,
      name: data.name,
      password: data.password,
      phone: data.phone,
      completed: true,
      commonUser: true,
      role: UserRole.USER,
    });

    this.logger.log(`Usuário registrado com sucesso: ${user.email}`);
    return { message: 'Registration successful', user: this.buildUserResponse(user) };
  }

  private buildUserResponse(user: User): Partial<User> {
    return {
      id: user.id,
      email: user.email,
      name: user.name,
      active: user.active,
      completed: user.completed,
      commonUser: user.commonUser,
      phone: user.phone,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
      role: user.role,
    };
  }
}
