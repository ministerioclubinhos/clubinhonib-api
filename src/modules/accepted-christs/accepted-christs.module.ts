import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { AuthModule } from 'src/core/auth/auth.module';
import { ChildrenModule } from 'src/modules/children/children.module';

import { AcceptedChristController } from './controllers/accepted-christ.controller';
import { AcceptedChristEntity } from './entities/accepted-christ.entity';
import { AcceptedChristRepository } from './repositories/accepted-christ.repository';
import { CreateAcceptedChristService } from './services/create-accepted-christ.service';
import { ClubsModule } from 'src/modules/clubs/clubs.module';
import { EmailModule } from 'src/shared/email';
import { SiteUrlModule } from 'src/shared/site-url';
import { DeleteAcceptedChristService } from './services/delete-accepted-christ.service';
import { NotifyAcceptedChristService } from './services/notify-accepted-christ.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([AcceptedChristEntity]),
    // O acesso à criança é conferido pelo módulo dono dela, pelo contrato de
    // serviço — nunca pelo repositório de crianças.
    forwardRef(() => ChildrenModule),
    forwardRef(() => AuthModule),
    // Quem avisar sobre uma decisão sai do clubinho da criança; o módulo de
    // clubes é quem sabe montar essa lista.
    forwardRef(() => ClubsModule),
    EmailModule,
    SiteUrlModule,
  ],
  controllers: [AcceptedChristController],
  providers: [
    CreateAcceptedChristService,
    DeleteAcceptedChristService,
    NotifyAcceptedChristService,
    AcceptedChristRepository,
  ],
  exports: [CreateAcceptedChristService, AcceptedChristRepository],
})
export class AcceptedChristsModule {}
