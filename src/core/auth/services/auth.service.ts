import { Injectable, Logger, Inject, forwardRef } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcryptjs';
import { CreateUserService } from 'src/core/user/services/create-user.service';
import { UserEntity } from 'src/core/user/entities/user.entity';
import { OAuth2Client } from 'google-auth-library';
import { MyProfileResponseDto } from 'src/core/user/dto/my-profile-response.dto';
import { GetUsersService } from 'src/core/user/services/get-user.service';
import { UpdateUserService } from 'src/core/user/services/update-user.service';
import { AuthRepository } from '../auth.repository';
import { CompleteUserDto } from '../dto/complete-register.dto';
import { RegisterUserDto } from '../dto/register.dto';
import { LoginDto } from '../dto/login.dto';
import { UserRole, JwtPayload } from '../auth.types';
import { EmailVerificationService } from './email-verification.service';
import { UpdateTeacherProfilesService } from 'src/modules/teacher-profiles/services/update-teacher-profiles.service';
import { NotificationService } from 'src/shared/providers/notification/notification.service';
import {
  AppUnauthorizedException,
  AppNotFoundException,
  AppConflictException,
  ErrorCode,
} from 'src/shared/exceptions';
import {
  AuthGoogleLoginResponseDto,
  AuthLoginResponseDto,
  AuthLogoutResponseDto,
  AuthRegisterResponseDto,
  AuthTokensResponseDto,
  AuthUserDto,
  LinkClubResponseDto,
} from '../dto/auth-response.dto';

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
    private readonly emailVerificationService: EmailVerificationService,
    @Inject(forwardRef(() => UpdateTeacherProfilesService))
    private readonly updateTeacherProfilesService: UpdateTeacherProfilesService,
    private readonly notificationService: NotificationService,
  ) {
    this.googleClient = new OAuth2Client(
      configService.getOrThrow<string>('GOOGLE_CLIENT_ID'),
    );
  }

  private generateTokens(user: UserEntity) {
    const payload = { sub: user.id, email: user.email, role: user.role };

    const accessToken = this.jwtService.sign(payload);
    const refreshToken = this.jwtService.sign(payload, {
      secret: this.configService.getOrThrow<string>('JWT_REFRESH_SECRET'),
      expiresIn: this.configService.getOrThrow<string>(
        'JWT_REFRESH_EXPIRES_IN',
      ),
    });

    return { accessToken, refreshToken };
  }

  async login({ email, password }: LoginDto): Promise<AuthLoginResponseDto> {
    const user = await this.authRepo.validateUser(email);
    if (!user || !(await bcrypt.compare(password, user.password))) {
      throw new AppUnauthorizedException(
        ErrorCode.INVALID_CREDENTIALS,
        'Credenciais inválidas',
      );
    }

    const emailVerification =
      await this.emailVerificationService.sendIfPending(user);

    if (!user.active) {
      return {
        message:
          'User is inactive. Please verify your email to activate your account.',
        user: this.buildUserResponse(user),
        emailVerification,
      };
    }

    const tokens = this.generateTokens(user);
    await this.updateRefreshToken(user.id, tokens.refreshToken);

    return {
      message: 'Login successful',
      user: this.buildUserResponse(user),
      ...tokens,
      emailVerification,
    };
  }

  async googleLogin(token: string): Promise<AuthGoogleLoginResponseDto> {
    try {
      const ticket = await this.googleClient.verifyIdToken({
        idToken: token,
        audience: this.configService.getOrThrow<string>('GOOGLE_CLIENT_ID'),
      });

      const payload = ticket.getPayload();
      if (!payload?.email || !payload?.name) {
        throw new AppUnauthorizedException(
          ErrorCode.TOKEN_INVALID,
          'Token do Google inválido',
        );
      }

      const { email, name } = payload;
      let user = await this.getUsersService.findByEmail(email);

      if (!user) {
        user = await this.createUserService.create({
          email,
          name,
          password: '',
          phone: '',
          active: false,
          completed: false,
          commonUser: false,
          role: UserRole.COORDINATOR,
        });

        const emailVerification =
          await this.emailVerificationService.sendIfPending(user);

        await this.notificationService.notifyNewUserRegistration(
          user,
          'google',
        );

        return {
          email,
          name,
          completed: user.completed,
          commonUser: user.commonUser,
          newUser: true,
          emailVerification,
        };
      }

      if (!user.completed) {
        const emailVerification =
          await this.emailVerificationService.sendIfPending(user);
        return {
          email,
          name,
          completed: false,
          commonUser: user.commonUser,
          newUser: true,
          emailVerification,
        };
      }

      if (!user.active) {
        const emailVerification =
          await this.emailVerificationService.sendIfPending(user);
        return {
          message: 'User is inactive',
          active: false,
          completed: user.completed,
          commonUser: user.commonUser,
          newUser: false,
          emailVerification,
        };
      }

      const emailVerification =
        await this.emailVerificationService.sendIfPending(user);

      const tokens = this.generateTokens(user);
      await this.updateRefreshToken(user.id, tokens.refreshToken);

      return {
        message: 'Login successful',
        isNewUser: false,
        user: this.buildUserResponse(user),
        ...tokens,
        emailVerification,
      };
    } catch (error: unknown) {
      const err = error as Error;
      this.logger.error(`Error during Google login: ${err.message}`, err.stack);

      if (
        err.message?.includes('Token used too late') ||
        err.message?.includes('expired')
      ) {
        throw new AppUnauthorizedException(
          ErrorCode.TOKEN_EXPIRED,
          'Token do Google expirado. Por favor, tente novamente.',
        );
      }

      if (err.message?.includes('Invalid token')) {
        throw new AppUnauthorizedException(
          ErrorCode.TOKEN_INVALID,
          'Token do Google inválido. Por favor, tente novamente.',
        );
      }

      throw new AppUnauthorizedException(
        ErrorCode.TOKEN_INVALID,
        'Falha na autenticação com Google. Por favor, tente novamente.',
      );
    }
  }

  async refreshToken(token: string): Promise<AuthTokensResponseDto> {
    if (!token) {
      throw new AppUnauthorizedException(
        ErrorCode.TOKEN_MISSING,
        'Refresh token é obrigatório',
      );
    }

    try {
      const payload = this.jwtService.verify<JwtPayload>(token, {
        secret: this.configService.getOrThrow<string>('JWT_REFRESH_SECRET'),
      });

      const user = await this.getUsersService.findOne(payload.sub);
      if (!user || user.refreshToken !== token) {
        throw new AppUnauthorizedException(
          ErrorCode.REFRESH_TOKEN_INVALID,
          'Refresh token inválido',
        );
      }

      const tokens = this.generateTokens(user);
      await this.updateRefreshToken(user.id, tokens.refreshToken);

      return tokens;
    } catch {
      throw new AppUnauthorizedException(
        ErrorCode.REFRESH_TOKEN_INVALID,
        'Refresh token inválido',
      );
    }
  }

  async logout(userId: string): Promise<AuthLogoutResponseDto> {
    await this.updateRefreshToken(userId, null);
    return { message: 'User logged out' };
  }

  /**
   * Perfil de quem está logado.
   *
   * Delega ao dono do contrato: `/auth/me` e `GET /profile` respondem a mesma
   * coisa, e antes cada um montava a sua versão — `/auth/me` esquecia
   * `active`, `completed`, `createdAt` e `updatedAt`.
   */
  async getMe(userId: string): Promise<MyProfileResponseDto> {
    return this.getUsersService.findOneForProfile(userId);
  }

  async completeRegister(
    data: CompleteUserDto,
  ): Promise<AuthRegisterResponseDto> {
    const user = await this.getUsersService.findByEmail(data.email);
    if (!user) {
      throw new AppNotFoundException(
        ErrorCode.USER_NOT_FOUND,
        'Usuário não encontrado',
      );
    }

    if (user.completed) {
      throw new AppConflictException(
        ErrorCode.USER_ALREADY_EXISTS,
        'Usuário já completou o cadastro',
      );
    }

    await this.updateUserService.update(user.id, {
      name: data.name,
      phone: data.phone,
      password: data.password,
      completed: true,
      role: data.role,
    });

    const emailVerification =
      await this.emailVerificationService.sendIfPending(user);

    return {
      message: 'Registration completed successfully',
      emailVerification,
    };
  }

  async register(data: RegisterUserDto): Promise<AuthRegisterResponseDto> {
    const existingUser = await this.getUsersService.findByEmail(data.email);
    if (existingUser) {
      throw new AppConflictException(
        ErrorCode.EMAIL_ALREADY_IN_USE,
        'Este email já está em uso',
      );
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

    const emailVerification =
      await this.emailVerificationService.sendIfPending(user);

    await this.notificationService.notifyNewUserRegistration(user, 'normal');

    return {
      message: 'Registration successful',
      user: this.buildUserResponse(user),
      emailVerification,
    };
  }

  private buildUserResponse(user: UserEntity): AuthUserDto {
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

  async updateRefreshToken(
    userId: string,
    token: string | null,
  ): Promise<void> {
    await this.updateUserService.updateRefreshToken(userId, token);
  }

  async linkTeacherToClub(
    userId: string,
    clubNumber: number,
  ): Promise<LinkClubResponseDto> {
    const profile = await this.updateTeacherProfilesService.linkOwnClubByNumber(
      userId,
      clubNumber,
    );
    return {
      message: `Professor vinculado ao clubinho #${profile.club?.number ?? clubNumber} com sucesso.`,
    };
  }
}
