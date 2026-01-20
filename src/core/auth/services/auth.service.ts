import { Injectable, Logger, Inject, forwardRef } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcryptjs';
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
import { UserRole } from '../auth.types';
import { MediaItemProcessor } from 'src/shared/media/media-item-processor';
import { PersonalDataRepository } from 'src/core/profile/repositories/personal-data.repository';
import { UserPreferencesRepository } from 'src/core/profile/repositories/user-preferences.repository';
import { SesIdentityService } from 'src/shared/providers/aws/ses-identity.service';
import {
  AppUnauthorizedException,
  AppNotFoundException,
  AppConflictException,
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
      expiresIn: this.configService.getOrThrow<string>('JWT_REFRESH_EXPIRES_IN') as any,
    });

    return { accessToken, refreshToken };
  }

  async login({ email, password }: LoginDto) {
    const user = await this.authRepo.validateUser(email, password);
    if (!user || !(await bcrypt.compare(password, user.password))) {
      throw new AppUnauthorizedException(
        ErrorCode.INVALID_CREDENTIALS,
        'Credenciais inválidas',
      );
    }

    const sesVerification = await this.sesIdentityService.checkAndResendSesVerification(email);

    if (!user.active) {
      return {
        message: 'User is inactive. Please verify your email to activate your account.',
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
    await this.updateRefreshToken(user.id, tokens.refreshToken);

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

        const sesVerification = await this.sesIdentityService.verifyEmailIdentitySES(email);

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
        const sesVerification = await this.sesIdentityService.checkAndResendSesVerification(email);
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

      if (!(user as any).active) {
        const sesVerification = await this.sesIdentityService.checkAndResendSesVerification(email);
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

      const sesVerification = await this.sesIdentityService.checkAndResendSesVerification(email);

      const tokens = this.generateTokens(user);
      await this.updateRefreshToken(user.id, tokens.refreshToken);

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
    } catch (error) {
      this.logger.error(`Error during Google login: ${error.message}`, error.stack);

      if (error.message?.includes('Token used too late') || error.message?.includes('expired')) {
        throw new AppUnauthorizedException(
          ErrorCode.TOKEN_EXPIRED,
          'Token do Google expirado. Por favor, tente novamente.',
        );
      }

      if (error.message?.includes('Invalid token')) {
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

    try {
      const payload = this.jwtService.verify(token, {
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

  async logout(userId: string) {
    await this.updateRefreshToken(userId, null);
    return { message: 'User logged out' };
  }

  private buildMeResponse(user: UserEntity, imageMedia?: any) {
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
      image: imageMedia ? {
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
      } : null,
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
            ? user.coordinatorProfile.clubs.map(club => ({
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
    const preferences = await this.userPreferencesRepository.findByUserId(userId);

    return {
      id: user.id,
      email: user.email,
      phone: user.phone,
      name: user.name,
      role: user.role,
      commonUser: user.commonUser,
      cpf: user.cpf,
      image: imageMedia ? {
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
      } : null,
      personalData: personalData ? {
        birthDate: personalData.birthDate
          ? (personalData.birthDate instanceof Date
            ? personalData.birthDate.toISOString().split('T')[0]
            : String(personalData.birthDate).split('T')[0])
          : undefined,
        gender: personalData.gender,
        gaLeaderName: personalData.gaLeaderName,
        gaLeaderContact: personalData.gaLeaderContact,
      } : undefined,
      preferences: preferences ? {
        loveLanguages: preferences.loveLanguages,
        temperaments: preferences.temperaments,
        favoriteColor: preferences.favoriteColor,
        favoriteFood: preferences.favoriteFood,
        favoriteMusic: preferences.favoriteMusic,
        whatMakesYouSmile: preferences.whatMakesYouSmile,
        skillsAndTalents: preferences.skillsAndTalents,
      } : undefined,
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
            ? user.coordinatorProfile.clubs.map(club => ({
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

    const sesVerification = await this.sesIdentityService.verifyEmailIdentitySES(data.email);

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

    const sesVerification = await this.sesIdentityService.verifyEmailIdentitySES(data.email);

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

  async updateRefreshToken(userId: string, token: string | null): Promise<void> {
    await this.userRepo.updateRefreshToken(userId, token);
  }
}
