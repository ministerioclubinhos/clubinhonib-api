import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { UserEntity } from './entities/user.entity';
import { MediaItemEntity } from 'src/shared/media/media-item/media-item.entity';

import { UserRepository } from './user.repository';
import { EmailModule } from 'src/shared/email/email.module';
import { SiteUrlModule } from 'src/shared/site-url';
import { EmailPreferencesController } from './email-preferences.controller';
import { GetEmailPreferencesService } from './services/get-email-preferences.service';
import { UpdateEmailPreferencesService } from './services/update-email-preferences.service';
import { CreateUserService } from './services/create-user.service';
import { GetUsersService } from './services/get-user.service';
import { UserController } from './user.controller';

import { TeacherProfilesModule } from 'src/modules/teacher-profiles/teacher-profiles.module';
import { CoordinatorProfilesModule } from 'src/modules/coordinator-profiles/coordinator-profiles.module';
import { MediaModule } from 'src/shared/media/media.module';
import { AuthModule } from 'src/core/auth/auth.module';
import { UpdateUserService } from './services/update-user.service';
import { DeleteUserService } from './services/delete-user.service';
import { UpdateUserImageService } from './services/update-user-image.service';
import { UpdateOwnProfileService } from './services/update-own-profile.service';
import { ChangePasswordService } from './services/change-password.service';
import { NotifyAccountChangesService } from './services/notify-account-changes.service';
import { ProfileController } from './profile.controller';
import { ProfileModule } from '../profile/profile.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([UserEntity, MediaItemEntity]),
    TeacherProfilesModule,
    CoordinatorProfilesModule,
    MediaModule,
    AuthModule,
    forwardRef(() => ProfileModule),
    EmailModule,
    SiteUrlModule,
  ],
  providers: [
    UserRepository,
    CreateUserService,
    GetUsersService,
    UpdateUserService,
    DeleteUserService,
    UpdateUserImageService,
    UpdateOwnProfileService,
    ChangePasswordService,
    NotifyAccountChangesService,
    GetEmailPreferencesService,
    UpdateEmailPreferencesService,
  ],
  controllers: [UserController, ProfileController, EmailPreferencesController],
  exports: [
    UserRepository,
    CreateUserService,
    GetUsersService,
    UpdateUserService,
    DeleteUserService,
    TypeOrmModule,
  ],
})
export class UserModule {}
