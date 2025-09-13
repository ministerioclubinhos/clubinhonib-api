import { Injectable, UnauthorizedException, Logger, NotFoundException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcryptjs';
import { CreateUserService } from 'src/user/services/create-user.service';
import { UserEntity } from 'src/user/user.entity';
import { OAuth2Client } from 'google-auth-library';
import { UserRepository } from 'src/user/user.repository';
import { GetUsersService } from 'src/user/services/get-user.service';
import { UpdateUserService } from 'src/user/services/update-user.service';
import { AuthRepository } from '../auth.repository';
import { CompleteUserDto } from '../dto/complete-register.dto';
import { RegisterUserDto } from '../dto/register.dto';
import { LoginDto } from '../dto/login.dto';
import { UserRole } from '../auth.types';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);
  private readonly googleClient: OAuth2Client;

  constructor(
    private readonly authRepo: AuthRepository,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly createUserService: CreateUserService,
    private readonly updateUserService: UpdateUserService,
    private readonly getUsersService: GetUsersService,
    private readonly userRepo: UserRepository
  ) {
    this.googleClient = new OAuth2Client(
      configService.getOrThrow<string>('GOOGLE_CLIENT_ID'),
    );
  }

  private generateTokens(user: UserEntity) {
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
    await this.updateRefreshToken(user.id, tokens.refreshToken);

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
      let user = await this.getUsersService.findByEmail(email);

      if (!user) {
        this.logger.log(`Criando novo usuário Google: ${email}`);
        user = await this.createUserService.create({
          email,
          name,
          password: '',
          phone: '',
          active: false,
          completed: false,
          commonUser: false,
          role: UserRole.TEACHER,
        });

        return { email, name, completed: user.completed, commonUser: user.commonUser, newUser: true };
      }

      if (!user.completed) {
        this.logger.log(`Usuário Google existente sem cadastro completo: ${email}`);
        return { email, name, completed: false, commonUser: user.commonUser, newUser: true };
      }

      if (!(user as any).active) {
        this.logger.warn(`Usuário Google inativo: ${email}`);
        return { message: 'UserEntity is inactive', active: false, completed: user.completed, commonUser: user.commonUser, newUser: false };
      }

      const tokens = this.generateTokens(user);
      await this.updateRefreshToken(user.id, tokens.refreshToken);

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

      const user = await this.getUsersService.findOne(payload.sub);
      if (!user || user.refreshToken !== token) {
        this.logger.warn(`Refresh token inválido para userId=${payload.sub}`);
        throw new UnauthorizedException('Invalid refresh token');
      }

      const tokens = this.generateTokens(user);
      await this.updateRefreshToken(user.id, tokens.refreshToken);

      this.logger.log(`Refresh token renovado para userId=${user.id}`);
      return tokens;
    } catch (error) {
      this.logger.error(`Erro ao renovar refresh token: ${error.message}`);
      throw new UnauthorizedException('Invalid refresh token');
    }
  }

  async logout(userId: string) {
    this.logger.debug(`Logout solicitado para userId=${userId}`);
    await this.updateRefreshToken(userId, null);
    this.logger.log(`Logout concluído para userId=${userId}`);
    return { message: 'UserEntity logged out' };
  }

  private buildMeResponse(user: UserEntity) {
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
      teacherProfile: user.teacherProfile
        ? {
          id: user.teacherProfile.id,
          active: user.teacherProfile.active,
          club: user.teacherProfile.club
            ? {
              id: user.teacherProfile.club.id,
              number: user.teacherProfile.club.number,
              weekday: user.teacherProfile.club.weekday,
            }
            : null,
        }
        : null,
      coordinatorProfile: user.coordinatorProfile
        ? {
          id: user.coordinatorProfile.id,
          active: user.coordinatorProfile.active,
          clubs: Array.isArray(user.coordinatorProfile.clubs)
            ? user.coordinatorProfile.clubs.map((c) => ({
              id: c.id,
              number: c.number,
              weekday: c.weekday,
            }))
            : [],
        }
        : null,
    };
  }

  async getMe(userId: string) {
    this.logger.debug(`Buscando dados do usuário: ${userId}`);

    const user = await this.userRepo.findByIdWithProfiles(userId);
    if (!user) {
      this.logger.warn(`Usuário não encontrado: ${userId}`);
      throw new UnauthorizedException('UserEntity not found');
    }

    return this.buildMeResponse(user);
  }

  async completeRegister(data: CompleteUserDto) {
    this.logger.debug(`Completar cadastro para: ${data.email}`);

    const user = await this.getUsersService.findByEmail(data.email);
    if (!user) {
      this.logger.warn(`Usuário não encontrado no completeRegister: ${data.email}`);
      throw new NotFoundException('UserEntity not found');
    }

    if (user.completed) {
      this.logger.warn(`Usuário já completou cadastro: ${data.email}`);
      throw new NotFoundException('UserEntity already completed registration');
    }

    await this.updateUserService.update(user.id, {
      name: data.name,
      phone: data.phone,
      password: data.password,
      completed: true,
      role: data.role,
    });

    this.logger.log(`Cadastro completado para: ${data.email}`);
    return { message: 'Registration completed successfully' };
  }

  async register(data: RegisterUserDto) {
    this.logger.debug(`Iniciando registro para: ${data.email}`);

    const existingUser = await this.getUsersService.findByEmail(data.email);
    if (existingUser) {
      this.logger.warn(`Tentativa de registrar email já existente: ${data.email}`);
      throw new UnauthorizedException('UserEntity already exists');
    }

    const user = await this.createUserService.create({
      email: data.email,
      name: data.name,
      password: data.password,
      phone: data.phone,
      active: false,
      completed: true,
      commonUser: true,
      role: data.role,
    });

    this.logger.log(`Usuário registrado com sucesso: ${user.email}`);
    return { message: 'Registration successful', user: this.buildUserResponse(user) };
  }

  private buildUserResponse(user: UserEntity): Partial<UserEntity> {
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

  async updateRefreshToken(userId: string, token: string | null): Promise<void> {
    this.logger.debug(`Updating refresh token for user ID: ${userId}`);
    await this.userRepo.updateRefreshToken(userId, token);
  }
}
