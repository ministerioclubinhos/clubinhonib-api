import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ProfileController } from './controllers/profile.controller';
import { CreateProfileService } from './services/profile/create-profile.service';
import { GetAllProfilesService } from './services/profile/get-all-profiles.service';
import { GetOneProfileService } from './services/profile/get-one-profile.service';
import { UpdateProfileService } from './services/profile/update-profile.service';
import { DeleteProfileService } from './services/profile/delete-profile.service';
import { UserRepository } from '../user/user.repository';
import { PersonalDataRepository } from './repositories/personal-data.repository';
import { UserPreferencesRepository } from './repositories/user-preferences.repository';
import { UserEntity } from '../user/entities/user.entity';
import { PersonalData } from './entities/personal-data.entity';
import { UserPreferences } from './entities/user-preferences.entity';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([UserEntity, PersonalData, UserPreferences]),
    AuthModule,
  ],
  controllers: [ProfileController],
  providers: [
    CreateProfileService,
    GetAllProfilesService,
    GetOneProfileService,
    UpdateProfileService,
    DeleteProfileService,
    UserRepository,
    PersonalDataRepository,
    UserPreferencesRepository,
  ],
  exports: [
    CreateProfileService,
    GetAllProfilesService,
    GetOneProfileService,
    UpdateProfileService,
    DeleteProfileService,
    PersonalDataRepository,
    UserPreferencesRepository,
  ],
})
export class ProfileModule {}
