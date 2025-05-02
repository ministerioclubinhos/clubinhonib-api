import { forwardRef, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RouteEntity } from './route-page.entity';
import { RouteRepository } from './route-page.repository';
import { DataSource } from 'typeorm';
import { RouteService } from './route.service';
import { RouteController } from './route.controller';
import { MeditationModule } from 'src/meditation/meditation.module'; // ✅ importar o módulo correto

@Module({
  imports: [
    TypeOrmModule.forFeature([RouteEntity]),
    forwardRef(() => MeditationModule),
  ],
  controllers: [RouteController],
  providers: [
    RouteService,
    {
      provide: RouteRepository,
      useFactory: (dataSource: DataSource) => new RouteRepository(dataSource),
      inject: [DataSource],
    },
  ],
  exports: [RouteService, RouteRepository],
})
export class RouteModule { }
