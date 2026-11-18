import { Module, forwardRef } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { ConfigModule, ConfigService } from '@nestjs/config';

import { TypeOrmModule } from '@nestjs/typeorm';

import { AuthController } from './auth.controller';
import { AuthRepository } from './auth.repository';
import { JwtStrategy } from './strategies/jwt.strategy';
import { AuthService } from './services/auth.service';
import { AuthContextService } from './services/auth-context.service';
import { UserModule } from 'src/core/user/user.module';
import { MediaModule } from 'src/shared/media/media.module';
import { AwsModule } from 'src/shared/providers/aws/aws.module';
import { TeacherProfilesModule } from 'src/modules/teacher-profiles/teacher-profiles.module';
import { ProfileModule } from '../profile/profile.module';
import { PasswordResetTokenRepository } from './repositories/password-reset-token.repository';
import { PasswordRecoveryService } from './services/password-recovery.service';
import { EmailVerificationTokenEntity } from './entities/email-verification-token.entity';
import { EmailVerificationTokenRepository } from './repositories/email-verification-token.repository';
import { EmailVerificationService } from './services/email-verification.service';
import { SiteUrlModule } from 'src/shared/site-url';
import { EmailModule } from 'src/shared/email';

@Module({
  imports: [
    ConfigModule,
    PassportModule.register({ defaultStrategy: 'jwt', session: false }),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.getOrThrow<string>('JWT_SECRET'),
        signOptions: {
          expiresIn: config.getOrThrow<string>('JWT_EXPIRES_IN'),
        },
      }),
    }),
    forwardRef(() => UserModule),
    MediaModule,
    forwardRef(() => ProfileModule),
    AwsModule,
    EmailModule,
    SiteUrlModule,
    TypeOrmModule.forFeature([EmailVerificationTokenEntity]),
    forwardRef(() => TeacherProfilesModule),
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    AuthContextService,
    AuthRepository,
    JwtStrategy,
    PasswordResetTokenRepository,
    PasswordRecoveryService,
    EmailVerificationTokenRepository,
    EmailVerificationService,
  ],
  exports: [
    AuthService,
    AuthContextService,
    JwtModule,
    PassportModule,
    JwtStrategy,
    PasswordRecoveryService,
    EmailVerificationService,
  ],
})
export class AuthModule {}
