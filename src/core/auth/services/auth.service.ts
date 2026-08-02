import { Injectable, Logger, Inject, forwardRef } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcryptjs';
import { createHash, randomUUID, timingSafeEqual } from 'node:crypto';
import { CreateUserService } from 'src/core/user/services/create-user.service';
import { UserEntity } from 'src/core/user/entities/user.entity';
import { OAuth2Client } from 'google-auth-library';
import { UserRepository } from 'src/core/user/user.repository';
import { GetUsersService } from 'src/core/user/services/get-user.service';
import { UpdateUserService } from 'src/core/user/services/update-user.service';
import { AuthRepository } from '../auth.repository';
import { CompleteUserDto } from '../dto/complete-register.dto';
import { RegisterUserDto } from '../dto/register.dto';
import { LoginDto } from '../dto/login.dto';
import { UserRole, JwtPayload } from '../auth.types';
import { MediaItemProcessor } from 'src/shared/media/media-item-processor';
import { MediaItemEntity } from 'src/shared/media/media-item/media-item.entity';
import { PersonalDataRepository } from 'src/core/profile/repositories/personal-data.repository';
import { UserPreferencesRepository } from 'src/core/profile/repositories/user-preferences.repository';
import { SesIdentityService } from 'src/shared/providers/aws/ses-identity.service';
import { TeacherProfilesRepository } from 'src/modules/teacher-profiles/repositories/teacher-profiles.repository';
import {
  AppUnauthorizedException,
  AppNotFoundException,
  AppConflictException,
  AppException,
  ErrorCode,
} from 'src/shared/exceptions';

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
    private readonly userRepo: UserRepository,
    private readonly mediaItemProcessor: MediaItemProcessor,
    @Inject(forwardRef(() => PersonalDataRepository))
    private readonly personalDataRepository: PersonalDataRepository,
    @Inject(forwardRef(() => UserPreferencesRepository))
    private readonly userPreferencesRepository: UserPreferencesRepository,
    private readonly sesIdentityService: SesIdentityService,
    @Inject(forwardRef(() => TeacherProfilesRepository))
    private readonly teacherProfilesRepository: TeacherProfilesRepository,
  ) {
    this.googleClient = new OAuth2Client(
      configService.getOrThrow<string>('GOOGLE_CLIENT_ID'),
    );
  }

  private generateTokens(user: UserEntity) {
    const basePayload = { sub: user.id, email: user.email, role: user.role };

    const accessToken = this.jwtService.sign({
      ...basePayload,
      tokenType: 'access',
      jti: randomUUID(),
    });
    const refreshToken = this.jwtService.sign(
      {
        ...basePayload,
        tokenType: 'refresh',
        jti: randomUUID(),
      },
      {
        secret: this.configService.getOrThrow<string>('JWT_REFRESH_SECRET'),
        expiresIn: this.configService.getOrThrow<string>(
          'JWT_REFRESH_EXPIRES_IN',
        ),
      },
    );

    return { accessToken, refreshToken };
  }

  private hashRefreshToken(token: string): string {
    return `sha256:${createHash('sha256').update(token).digest('hex')}`;
  }

  private refreshTokenMatches(
    storedToken: string | null,
    token: string,
  ): boolean {
    if (!storedToken || !token) return false;

    const candidate = storedToken.startsWith('sha256:')
      ? this.hashRefreshToken(token)
      : token;
    const storedBuffer = Buffer.from(storedToken);
    const candidateBuffer = Buffer.from(candidate);

    return (
      storedBuffer.length === candidateBuffer.length &&
      timingSafeEqual(storedBuffer, candidateBuffer)
    );
  }

  private async persistRefreshToken(
    userId: string,
    token: string,
  ): Promise<void> {
    await this.userRepo.updateRefreshToken(
      userId,
      this.hashRefreshToken(token),
    );
  }

  async login({ email, password }: LoginDto) {
    const user = await this.authRepo.validateUser(email);
    if (!user || !(await bcrypt.compare(password, user.password))) {
      throw new AppUnauthorizedException(
        ErrorCode.INVALID_CREDENTIALS,
        'Credenciais inválidas',
      );
    }

    const sesVerification =
      await this.sesIdentityService.checkAndResendSesVerification(email);

    if (!user.active) {
      return {
        message:
          'User is inactive. Please verify your email to activate your account.',
        user: this.buildUserResponse(user),
        emailVerification: {
          verificationEmailSent: sesVerification.verificationEmailSent,
          message: sesVerification.verificationEmailSent
            ? 'Um email de verificação foi enviado para o seu endereço. Por favor, verifique sua caixa de entrada.'
            : sesVerification.alreadyVerified
              ? 'Email já verificado.'
              : undefined,
        },
      };
    }

    const tokens = this.generateTokens(user);
    await this.persistRefreshToken(user.id, tokens.refreshToken);

    return {
      message: 'Login successful',
      user: this.buildUserResponse(user),
      ...tokens,
      emailVerification: {
        verificationEmailSent: sesVerification.verificationEmailSent,
        message: sesVerification.verificationEmailSent
          ? 'Um email de verificação foi enviado para o seu endereço. Por favor, verifique sua caixa de entrada.'
          : sesVerification.alreadyVerified
            ? 'Email já verificado.'
            : undefined,
      },
    };
  }

  async googleLogin(token: string) {
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

      const email = payload.email.trim().toLowerCase();
      const { name } = payload;
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

        const sesVerification =
          await this.sesIdentityService.verifyEmailIdentitySES(email);

        return {
          email,
          name,
          completed: user.completed,
          commonUser: user.commonUser,
          newUser: true,
          emailVerification: {
            verificationEmailSent: sesVerification.verificationEmailSent,
            message: sesVerification.verificationEmailSent
              ? 'Um email de verificação foi enviado para o seu endereço. Por favor, verifique sua caixa de entrada.'
              : undefined,
          },
        };
      }

      if (!user.completed) {
        const sesVerification =
          await this.sesIdentityService.checkAndResendSesVerification(email);
        return {
          email,
          name,
          completed: false,
          commonUser: user.commonUser,
          newUser: true,
          emailVerification: {
            verificationEmailSent: sesVerification.verificationEmailSent,
            message: sesVerification.verificationEmailSent
              ? 'Um email de verificação foi enviado para o seu endereço. Por favor, verifique sua caixa de entrada.'
              : undefined,
          },
        };
      }

      if (!user.active) {
        const sesVerification =
          await this.sesIdentityService.checkAndResendSesVerification(email);
        return {
          message: 'User is inactive',
          active: false,
          completed: user.completed,
          commonUser: user.commonUser,
          newUser: false,
          emailVerification: {
            verificationEmailSent: sesVerification.verificationEmailSent,
            message: sesVerification.verificationEmailSent
              ? 'Um email de verificação foi enviado para o seu endereço. Por favor, verifique sua caixa de entrada.'
              : undefined,
          },
        };
      }

      const sesVerification =
        await this.sesIdentityService.checkAndResendSesVerification(email);

      const tokens = this.generateTokens(user);
      await this.persistRefreshToken(user.id, tokens.refreshToken);

      return {
        message: 'Login successful',
        isNewUser: false,
        user: this.buildUserResponse(user),
        ...tokens,
        emailVerification: {
          verificationEmailSent: sesVerification.verificationEmailSent,
          message: sesVerification.verificationEmailSent
            ? 'Um email de verificação foi enviado para o seu endereço. Por favor, verifique sua caixa de entrada.'
            : sesVerification.alreadyVerified
              ? 'Email já verificado.'
              : undefined,
        },
      };
    } catch (error: any) {
      const err = error as Error;
      this.logger.error(`Error during Google login: ${err.message}`, err.stack);

      if (error instanceof AppException) {
        throw error;
      }

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

  async refreshToken(token: string) {
    if (!token) {
      throw new AppUnauthorizedException(
        ErrorCode.TOKEN_MISSING,
        'Refresh token é obrigatório',
      );
    }

    let payload: JwtPayload;
    try {
      payload = this.jwtService.verify<JwtPayload>(token, {
        secret: this.configService.getOrThrow<string>('JWT_REFRESH_SECRET'),
      });
    } catch {
      throw new AppUnauthorizedException(
        ErrorCode.REFRESH_TOKEN_INVALID,
        'Refresh token inválido',
      );
    }

    if (
      !payload.sub ||
      (payload.tokenType && payload.tokenType !== 'refresh')
    ) {
      throw new AppUnauthorizedException(
        ErrorCode.REFRESH_TOKEN_INVALID,
        'Refresh token inválido',
      );
    }

    const user = await this.userRepo.findById(payload.sub);
    const storedRefreshToken = user?.refreshToken ?? null;
    if (
      !user ||
      !user.active ||
      !this.refreshTokenMatches(storedRefreshToken, token)
    ) {
      throw new AppUnauthorizedException(
        ErrorCode.REFRESH_TOKEN_INVALID,
        'Refresh token inválido',
      );
    }

    const tokens = this.generateTokens(user);
    const rotated = await this.userRepo.rotateRefreshToken(
      user.id,
      storedRefreshToken!,
      this.hashRefreshToken(tokens.refreshToken),
    );

    if (!rotated) {
      throw new AppUnauthorizedException(
        ErrorCode.REFRESH_TOKEN_INVALID,
        'Refresh token já utilizado',
      );
    }

    return tokens;
  }

  async logout(tokens: { refreshToken?: string; accessToken?: string }) {
    const { refreshToken, accessToken } = tokens;
    let revoked = false;

    if (refreshToken) {
      try {
        const payload = this.jwtService.verify<JwtPayload>(refreshToken, {
          secret: this.configService.getOrThrow<string>('JWT_REFRESH_SECRET'),
        });
        if (!payload.tokenType || payload.tokenType === 'refresh') {
          const user = await this.userRepo.findById(payload.sub);
          if (
            user?.refreshToken &&
            this.refreshTokenMatches(user.refreshToken, refreshToken)
          ) {
            revoked = await this.userRepo.rotateRefreshToken(
              user.id,
              user.refreshToken,
              null,
            );
          }
        }
      } catch {
        // Logout is intentionally idempotent and does not reveal token state.
      }
    }

    if (!revoked && accessToken) {
      try {
        const payload = this.jwtService.verify<JwtPayload>(accessToken, {
          secret: this.configService.getOrThrow<string>('JWT_SECRET'),
        });
        if (!payload.tokenType || payload.tokenType === 'access') {
          await this.userRepo.updateRefreshToken(payload.sub, null);
        }
      } catch {
        // Local logout must still succeed when the access token has expired.
      }
    }

    return { message: 'User logged out' };
  }

  private buildMeResponse(
    user: UserEntity,
    imageMedia?: MediaItemEntity | null,
  ) {
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
      image: imageMedia
        ? {
            id: imageMedia.id,
            title: imageMedia.title,
            description: imageMedia.description,
            url: imageMedia.url,
            uploadType: imageMedia.uploadType,
            mediaType: imageMedia.mediaType,
            isLocalFile: imageMedia.isLocalFile,
            platformType: imageMedia.platformType,
            originalName: imageMedia.originalName,
            size: imageMedia.size,
            createdAt: imageMedia.createdAt,
            updatedAt: imageMedia.updatedAt,
          }
        : null,
      teacherProfile: user.teacherProfile
        ? {
            id: user.teacherProfile.id,
            active: user.teacherProfile.active,
            club: user.teacherProfile.club
              ? {
                  id: user.teacherProfile.club.id,
                  number: user.teacherProfile.club.number,
                  weekday: user.teacherProfile.club.weekday,
                  time: user.teacherProfile.club.time,
                  isActive: user.teacherProfile.club.isActive,
                }
              : null,
          }
        : null,
      coordinatorProfile: user.coordinatorProfile
        ? {
            id: user.coordinatorProfile.id,
            active: user.coordinatorProfile.active,
            clubs: user.coordinatorProfile.clubs
              ? user.coordinatorProfile.clubs.map((club) => ({
                  id: club.id,
                  number: club.number,
                  weekday: club.weekday,
                  time: club.time,
                  isActive: club.isActive,
                }))
              : [],
          }
        : null,
    };
  }

  async getMe(userId: string) {
    const user = await this.userRepo.findByIdWithProfiles(userId);
    if (!user) {
      throw new AppUnauthorizedException(
        ErrorCode.USER_NOT_FOUND,
        'Usuário não encontrado',
      );
    }

    const imageMedia = await this.mediaItemProcessor.findMediaItemByTarget(
      userId,
      'UserEntity',
    );

    const personalData = await this.personalDataRepository.findByUserId(userId);
    const preferences =
      await this.userPreferencesRepository.findByUserId(userId);

    return {
      id: user.id,
      email: user.email,
      phone: user.phone,
      name: user.name,
      role: user.role,
      commonUser: user.commonUser,
      cpf: user.cpf,
      image: imageMedia
        ? {
            id: imageMedia.id,
            title: imageMedia.title,
            description: imageMedia.description,
            url: imageMedia.url,
            uploadType: imageMedia.uploadType,
            mediaType: imageMedia.mediaType,
            isLocalFile: imageMedia.isLocalFile,
            platformType: imageMedia.platformType,
            originalName: imageMedia.originalName,
            size: imageMedia.size,
            createdAt: imageMedia.createdAt,
            updatedAt: imageMedia.updatedAt,
          }
        : null,
      personalData: personalData
        ? {
            birthDate: personalData.birthDate
              ? personalData.birthDate instanceof Date
                ? personalData.birthDate.toISOString().split('T')[0]
                : String(personalData.birthDate).split('T')[0]
              : undefined,
            gender: personalData.gender,
            gaLeaderName: personalData.gaLeaderName,
            gaLeaderContact: personalData.gaLeaderContact,
          }
        : undefined,
      preferences: preferences
        ? {
            loveLanguages: preferences.loveLanguages,
            temperaments: preferences.temperaments,
            favoriteColor: preferences.favoriteColor,
            favoriteFood: preferences.favoriteFood,
            favoriteMusic: preferences.favoriteMusic,
            whatMakesYouSmile: preferences.whatMakesYouSmile,
            skillsAndTalents: preferences.skillsAndTalents,
          }
        : undefined,
      teacherProfile: user.teacherProfile
        ? {
            id: user.teacherProfile.id,
            active: user.teacherProfile.active,
            club: user.teacherProfile.club
              ? {
                  id: user.teacherProfile.club.id,
                  number: user.teacherProfile.club.number,
                  weekday: user.teacherProfile.club.weekday,
                  time: user.teacherProfile.club.time,
                  isActive: user.teacherProfile.club.isActive,
                }
              : null,
          }
        : null,
      coordinatorProfile: user.coordinatorProfile
        ? {
            id: user.coordinatorProfile.id,
            active: user.coordinatorProfile.active,
            clubs: user.coordinatorProfile.clubs
              ? user.coordinatorProfile.clubs.map((club) => ({
                  id: club.id,
                  number: club.number,
                  weekday: club.weekday,
                  time: club.time,
                  isActive: club.isActive,
                }))
              : [],
          }
        : null,
    };
  }

  async completeRegister(data: CompleteUserDto) {
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

    const sesVerification =
      await this.sesIdentityService.verifyEmailIdentitySES(data.email);

    return {
      message: 'Registration completed successfully',
      emailVerification: {
        verificationEmailSent: sesVerification.verificationEmailSent,
        message: sesVerification.verificationEmailSent
          ? 'Um email de verificação foi enviado para o seu endereço. Por favor, verifique sua caixa de entrada.'
          : undefined,
      },
    };
  }

  async register(data: RegisterUserDto) {
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

    const sesVerification =
      await this.sesIdentityService.verifyEmailIdentitySES(data.email);

    return {
      message: 'Registration successful',
      user: this.buildUserResponse(user),
      emailVerification: {
        verificationEmailSent: sesVerification.verificationEmailSent,
        message: sesVerification.verificationEmailSent
          ? 'Um email de verificação foi enviado para o seu endereço. Por favor, verifique sua caixa de entrada para completar o cadastro.'
          : undefined,
      },
    };
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

  async linkTeacherToClub(
    userId: string,
    clubNumber: number,
  ): Promise<{ message: string }> {
    const profile =
      await this.teacherProfilesRepository.linkTeacherToClubByNumber(
        userId,
        clubNumber,
      );
    return {
      message: `Professor vinculado ao clubinho #${profile.club?.number ?? clubNumber} com sucesso.`,
    };
  }
}
