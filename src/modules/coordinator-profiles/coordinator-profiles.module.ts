import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { CoordinatorProfileEntity } from './entities/coordinator-profile.entity/coordinator-profile.entity';
import { CoordinatorProfilesRepository } from './repositories/coordinator-profiles.repository';
import { CoordinatorProfilesService } from './services/coordinator-profiles.service';
import { CoordinatorProfilesController } from './coordinator-profiles.controller';

import { TeacherProfilesModule } from '../teacher-profiles/teacher-profiles.module';
import { ClubsModule } from '../clubs/clubs.module';
import { UserModule } from 'src/user/user.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([CoordinatorProfileEntity]),
    forwardRef(() => TeacherProfilesModule),
    forwardRef(() => ClubsModule),
    forwardRef(() => UserModule),
  ],
  controllers: [CoordinatorProfilesController],
  providers: [CoordinatorProfilesRepository, CoordinatorProfilesService],
  exports: [CoordinatorProfilesRepository, CoordinatorProfilesService, TypeOrmModule],
})
export class CoordinatorProfilesModule {}
