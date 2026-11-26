import { forwardRef, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RouteEntity } from './route-page.entity';
import { RouteRepository } from './route-page.repository';
import { DataSource } from 'typeorm';
import { CreateRouteService } from './services/create-route.service';
import { GetRouteService } from './services/get-route.service';
import { UpdateRouteService } from './services/update-route.service';
import { DeleteRouteService } from './services/delete-route.service';
import { RouteController } from './route.controller';
import { MeditationModule } from 'src/modules/meditations/meditation.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([RouteEntity]),
    forwardRef(() => MeditationModule),
  ],
  controllers: [RouteController],
  providers: [
    CreateRouteService,
    GetRouteService,
    UpdateRouteService,
    DeleteRouteService,
    {
      provide: RouteRepository,
      useFactory: (dataSource: DataSource) => new RouteRepository(dataSource),
      inject: [DataSource],
    },
  ],
  exports: [
    CreateRouteService,
    GetRouteService,
    UpdateRouteService,
    DeleteRouteService,
  ],
})
export class RouteModule {}
