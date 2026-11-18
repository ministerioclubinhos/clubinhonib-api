import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { AuthModule } from 'src/core/auth/auth.module';

import { PagelaEntity } from './entities/pagela.entity';
import { ChildEntity } from 'src/modules/children/entities/child.entity';
import { TeacherProfileEntity } from 'src/modules/teacher-profiles/entities/teacher-profile.entity/teacher-profile.entity';

import { PagelasController } from './pagelas.controller';
import { PagelasRepository } from './repositories/pagelas.repository';
import { CreatePagelasService } from './services/create-pagelas.service';
import { GetPagelasService } from './services/get-pagelas.service';
import { UpdatePagelasService } from './services/update-pagelas.service';
import { DeletePagelasService } from './services/delete-pagelas.service';
import { ResolvePagelaWeekService } from './services/resolve-pagela-week.service';

import { PagelaLaunchWindowService } from './services/pagela-launch-window.service';
import { ClubControlModule } from '../club-control/club-control.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([PagelaEntity, ChildEntity, TeacherProfileEntity]),
    forwardRef(() => ClubControlModule),
    forwardRef(() => AuthModule),
  ],
  controllers: [PagelasController],
  providers: [
    PagelasRepository,
    ResolvePagelaWeekService,
    PagelaLaunchWindowService,
    CreatePagelasService,
    GetPagelasService,
    UpdatePagelasService,
    DeletePagelasService,
  ],
  exports: [
    // Sai do módulo porque o controle de clubinhos precisa resolver a semana
    // letiva de uma data para os avisos de pagela, e a regra de qual período
    // vale — inclusive na virada do ano — mora aqui.
    ResolvePagelaWeekService,
    PagelaLaunchWindowService,
    CreatePagelasService,
    GetPagelasService,
    UpdatePagelasService,
    DeletePagelasService,
  ],
})
export class PagelasModule {}
