import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { InformativeEntity } from './entities/informative.entity';
import { InformativesRepository } from './repositories/informatives.repository';
import { InformativeController } from './informative.controller';

import { CreateInformativeService } from './services/create-informative.service';
import { AnnounceInformativeService } from './services/announce-informative.service';
import { EmailModule } from 'src/shared/email';
import { SiteUrlModule } from 'src/shared/site-url';
import { UserModule } from 'src/core/user/user.module';
import { GetInformativeService } from './services/get-informative.service';
import { UpdateInformativeService } from './services/update-informative.service';
import { DeleteInformativeService } from './services/delete-informative.service';

import { RouteModule } from 'src/modules/routes/route.module';
import { MeditationModule } from 'src/modules/meditations/meditation.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([InformativeEntity]),
    MeditationModule,
    RouteModule,
    EmailModule,
    SiteUrlModule,
    UserModule,
  ],
  controllers: [InformativeController],
  providers: [
    CreateInformativeService,
    AnnounceInformativeService,
    GetInformativeService,
    UpdateInformativeService,
    DeleteInformativeService,
    InformativesRepository,
  ],
  exports: [
    CreateInformativeService,
    AnnounceInformativeService,
    GetInformativeService,
    UpdateInformativeService,
    DeleteInformativeService,
  ],
})
export class InformativeModule {}
