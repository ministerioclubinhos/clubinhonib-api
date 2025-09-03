import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { ClubsController } from './clubs.controller';
import { DeleteClubsService } from './services/delete-clubs.service';
import { UpdateClubsService } from './services/update-clubs.service';
import { GetClubsService } from './services/get-clubs.service';
import { CreateClubsService } from './services/create-clubs.service';

import { ClubsRepository } from './repositories/clubs.repository';
import { ClubEntity } from './entities/club.entity/club.entity';

import { TeacherProfilesModule } from '../teacher-profiles/teacher-profiles.module';
import { AddressesModule } from '../addresses/addresses.module';
import { CoordinatorProfilesModule } from '../coordinator-profiles/coordinator-profiles.module';
import { AddressEntity } from '../addresses/entities/address.entity/address.entity';
import { ChildrenModule } from '../children/children.module';
import { AuthModule } from 'src/auth/auth.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([ClubEntity, AddressEntity]),
    forwardRef(() => AddressesModule),
    forwardRef(() => TeacherProfilesModule),
    forwardRef(() => CoordinatorProfilesModule),
    forwardRef(() => ChildrenModule),
    forwardRef(() => AuthModule),
  ],
  controllers: [ClubsController],
  providers: [
    DeleteClubsService,
    UpdateClubsService,
    GetClubsService,
    CreateClubsService,
    ClubsRepository,
  ],
  exports: [
    DeleteClubsService,
    UpdateClubsService,
    GetClubsService,
    CreateClubsService,
    ClubsRepository,
    TypeOrmModule,
  ],
})
export class ClubsModule { }
