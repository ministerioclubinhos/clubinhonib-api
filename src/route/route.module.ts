import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RouteEntity } from './route-page.entity';
import { RouteRepository } from './route-page.repository';
import { DataSource } from 'typeorm';
import { RouteService } from './route.service';
import { RouteController } from './route.controller';

@Module({
  imports: [TypeOrmModule.forFeature([RouteEntity])],
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
