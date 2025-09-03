import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { TeacherProfilesRepository } from './repositories/teacher-profiles.repository';
import { TeacherProfilesService } from './services/teacher-profiles.service';
import { TeacherProfilesController } from './teacher-profiles.controller';

import { TeacherProfileEntity } from './entities/teacher-profile.entity/teacher-profile.entity';
import { CoordinatorProfilesModule } from '../coordinator-profiles/coordinator-profiles.module';
import { ClubsModule } from '../clubs/clubs.module';
import { UserModule } from 'src/user/user.module';
import { AuthModule } from 'src/auth/auth.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([TeacherProfileEntity]),
    forwardRef(() => CoordinatorProfilesModule),
    forwardRef(() => ClubsModule),
    forwardRef(() => UserModule),
    forwardRef(() => AuthModule),
  ],
  controllers: [TeacherProfilesController],
  providers: [TeacherProfilesRepository, TeacherProfilesService],
  exports: [TeacherProfilesRepository, TeacherProfilesService, TypeOrmModule],
})
export class TeacherProfilesModule { }
