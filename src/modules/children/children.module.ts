import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ChildrenController } from './children.controller';
import { GetChildrenService } from './services/get-children.service';
import { CreateChildrenService } from './services/create-children.service';
import { UpdateChildrenService } from './services/update-children.service';
import { DeleteChildrenService } from './services/delete-children.service';
import { ClubEntity } from '../clubs/entities/club.entity';
import { AddressEntity } from '../addresses/entities/address.entity/address.entity';
import { ChildEntity } from './entities/child.entity';
import { ChildrenRepository } from './repositories/children.repository';
import { AddressesModule } from '../addresses/addresses.module';
import { ClubsModule } from '../clubs/clubs.module';
import { AuthModule } from 'src/core/auth/auth.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([ChildEntity, ClubEntity, AddressEntity]),
    AddressesModule,
    forwardRef(() => ClubsModule),
    forwardRef(() => AuthModule),
  ],
  controllers: [ChildrenController],
  providers: [
    GetChildrenService,
    CreateChildrenService,
    UpdateChildrenService,
    DeleteChildrenService,
    ChildrenRepository,
  ],
  exports: [
    GetChildrenService,
    CreateChildrenService,
    UpdateChildrenService,
    DeleteChildrenService,
    ChildrenRepository,
  ],
})
export class ChildrenModule {}
