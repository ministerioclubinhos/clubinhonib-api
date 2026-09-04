import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { CoordinatorProfileEntity } from './entities/coordinator-profile.entity/coordinator-profile.entity';
import { CoordinatorProfilesRepository } from './repositories/coordinator-profiles.repository';
import { CreateCoordinatorProfilesService } from './services/create-coordinator-profiles.service';
import { DeleteCoordinatorProfilesService } from './services/delete-coordinator-profiles.service';
import { GetCoordinatorProfilesService } from './services/get-coordinator-profiles.service';
import { UpdateCoordinatorProfilesService } from './services/update-coordinator-profiles.service';
import { CoordinatorProfilesController } from './coordinator-profiles.controller';

import { TeacherProfilesModule } from '../teacher-profiles/teacher-profiles.module';
import { ClubsModule } from '../clubs/clubs.module';
import { UserModule } from 'src/core/user/user.module';
import { AuthModule } from 'src/core/auth/auth.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([CoordinatorProfileEntity]),
    forwardRef(() => TeacherProfilesModule),
    forwardRef(() => ClubsModule),
    forwardRef(() => UserModule),
    forwardRef(() => AuthModule),
  ],
  controllers: [CoordinatorProfilesController],
  providers: [
    CoordinatorProfilesRepository,
    CreateCoordinatorProfilesService,
    DeleteCoordinatorProfilesService,
    GetCoordinatorProfilesService,
    UpdateCoordinatorProfilesService,
  ],
  exports: [
    CoordinatorProfilesRepository,
    CreateCoordinatorProfilesService,
    DeleteCoordinatorProfilesService,
    GetCoordinatorProfilesService,
    UpdateCoordinatorProfilesService,
    TypeOrmModule,
  ],
})
export class CoordinatorProfilesModule {}
