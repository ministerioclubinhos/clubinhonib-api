import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { UserEntity } from './user.entity';
import { ClubEntity } from 'src/modules/clubs/entities/club.entity/club.entity';

import { UserRepository } from './user.repository';
import { CreateUserService } from './services/create-user.service';
import { GetUsersService } from './services/get-user.service';
import { UserController } from './user.controller';

import { TeacherProfilesModule } from 'src/modules/teacher-profiles/teacher-profiles.module';
import { CoordinatorProfilesModule } from 'src/modules/coordinator-profiles/coordinator-profiles.module';
import { UpdateUserService } from './services/update-user.service';
import { DeleteUserService } from './services/delete-user.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([UserEntity, ClubEntity]),
    TeacherProfilesModule,
    CoordinatorProfilesModule,
  ],
  providers: [UserRepository, CreateUserService, GetUsersService, UpdateUserService, DeleteUserService],
  controllers: [UserController],
  exports: [UserRepository,  CreateUserService, GetUsersService, UpdateUserService, DeleteUserService, TypeOrmModule],
})
export class UserModule {}
