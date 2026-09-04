import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { TeacherProfilesRepository } from './repositories/teacher-profiles.repository';
import { CreateTeacherProfilesService } from './services/create-teacher-profiles.service';
import { DeleteTeacherProfilesService } from './services/delete-teacher-profiles.service';
import { GetTeacherProfilesService } from './services/get-teacher-profiles.service';
import { UpdateTeacherProfilesService } from './services/update-teacher-profiles.service';
import { TeacherProfilesController } from './teacher-profiles.controller';

import { TeacherProfileEntity } from './entities/teacher-profile.entity/teacher-profile.entity';
import { CoordinatorProfilesModule } from '../coordinator-profiles/coordinator-profiles.module';
import { ClubsModule } from '../clubs/clubs.module';
import { UserModule } from 'src/core/user/user.module';
import { AuthModule } from 'src/core/auth/auth.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([TeacherProfileEntity]),
    forwardRef(() => CoordinatorProfilesModule),
    forwardRef(() => ClubsModule),
    forwardRef(() => UserModule),
    forwardRef(() => AuthModule),
  ],
  controllers: [TeacherProfilesController],
  providers: [
    TeacherProfilesRepository,
    CreateTeacherProfilesService,
    DeleteTeacherProfilesService,
    GetTeacherProfilesService,
    UpdateTeacherProfilesService,
  ],
  exports: [
    TeacherProfilesRepository,
    CreateTeacherProfilesService,
    DeleteTeacherProfilesService,
    GetTeacherProfilesService,
    UpdateTeacherProfilesService,
    TypeOrmModule,
  ],
})
export class TeacherProfilesModule {}
