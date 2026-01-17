import { Injectable, UnauthorizedException, Logger, NotFoundException, Inject, forwardRef, BadRequestException } from '@nestjs/common';
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
      throw new UnauthorizedException('Invalid credentials');
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
        throw new UnauthorizedException('Invalid Google token payload');
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
        throw new UnauthorizedException('Google authentication token has expired. Please try signing in again.');
      }

      if (error.message?.includes('Invalid token')) {
        throw new UnauthorizedException('Invalid Google authentication token. Please try signing in again.');
      }

      throw new UnauthorizedException('Google authentication failed. Please try signing in with Google again.');
    }
  }

  async refreshToken(token: string) {
    if (!token) {
      throw new UnauthorizedException('Refresh token is required');
    }

    try {
      const payload = this.jwtService.verify(token, {
        secret: this.configService.getOrThrow<string>('JWT_REFRESH_SECRET'),
      });

      const user = await this.getUsersService.findOne(payload.sub);
      if (!user || user.refreshToken !== token) {
        throw new UnauthorizedException('Invalid refresh token');
      }

      const tokens = this.generateTokens(user);
      await this.updateRefreshToken(user.id, tokens.refreshToken);

      return tokens;
    } catch (error) {
      throw new UnauthorizedException('Invalid refresh token');
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
      throw new UnauthorizedException('User not found');
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
      throw new NotFoundException('User not found');
    }

    if (user.completed) {
      throw new NotFoundException('User already completed registration');
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
      throw new UnauthorizedException('User already exists');
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
