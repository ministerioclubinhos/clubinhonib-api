import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ChildrenController } from './children.controller';
import { ChildrenService } from './children.service';
import { ClubEntity } from '../clubs/entities/club.entity/club.entity';
import { AddressEntity } from '../addresses/entities/address.entity/address.entity';
import { ChildEntity } from './entities/child.entity';
import { ChildrenRepository } from './repositories/children.repository';
import { AddressesModule } from '../addresses/addresses.module';
import { ClubsModule } from '../clubs/clubs.module';
import { AuthModule } from 'src/auth/auth.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([ChildEntity, ClubEntity, AddressEntity]),
    AddressesModule,
    forwardRef(() => ClubsModule),
    forwardRef(() => AuthModule),
  ],
  controllers: [ChildrenController],
  providers: [ChildrenService, ChildrenRepository],
  exports: [ChildrenService, ChildrenRepository],
})
export class ChildrenModule { }
