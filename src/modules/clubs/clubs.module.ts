import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { ClubsController } from './clubs.controller';
import { DeleteClubsService } from './services/delete-clubs.service';
import { UpdateClubsService } from './services/update-clubs.service';
import { GetClubsService } from './services/get-clubs.service';
import { GetClubRecipientsService } from './services/get-club-recipients.service';
import { UserModule } from 'src/core/user/user.module';
import { CreateClubsService } from './services/create-clubs.service';

import { ClubsRepository } from './repositories/clubs.repository';
import { ClubEntity } from './entities/club.entity';

import { TeacherProfilesModule } from '../teacher-profiles/teacher-profiles.module';
import { AddressesModule } from '../addresses/addresses.module';
import { CoordinatorProfilesModule } from '../coordinator-profiles/coordinator-profiles.module';
import { AddressEntity } from '../addresses/entities/address.entity/address.entity';
import { ChildrenModule } from '../children/children.module';
import { AuthModule } from 'src/core/auth/auth.module';
import { EventModule } from 'src/modules/pages/event-page/event.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([ClubEntity, AddressEntity]),
    forwardRef(() => AddressesModule),
    forwardRef(() => TeacherProfilesModule),
    forwardRef(() => CoordinatorProfilesModule),
    forwardRef(() => ChildrenModule),
    forwardRef(() => AuthModule),
    forwardRef(() => EventModule),
    // Quem decide se uma pessoa pode receber um aviso é o módulo de usuário.
    // `forwardRef` porque ele chega de volta aqui pelos perfis de professor e
    // de coordenador — é o mesmo laço dos outros seis imports acima.
    forwardRef(() => UserModule),
  ],
  controllers: [ClubsController],
  providers: [
    DeleteClubsService,
    UpdateClubsService,
    GetClubsService,
    GetClubRecipientsService,
    CreateClubsService,
    ClubsRepository,
  ],
  exports: [
    DeleteClubsService,
    UpdateClubsService,
    GetClubsService,
    GetClubRecipientsService,
    CreateClubsService,
    ClubsRepository,
    TypeOrmModule,
  ],
})
export class ClubsModule {}
