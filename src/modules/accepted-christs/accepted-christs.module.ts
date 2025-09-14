import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AcceptedChristEntity } from './entities/accepted-christ.entity';
import { ChildEntity } from '../children/entities/child.entity';
import { AcceptedChristRepository } from './repositories/accepted-christ.repository';
import { AcceptedChristService } from './services/accepted-christ.service';
import { AcceptedChristController } from './controllers/accepted-christ.controller';

@Module({
  imports: [TypeOrmModule.forFeature([AcceptedChristEntity, ChildEntity])],
  controllers: [AcceptedChristController],
  providers: [AcceptedChristService, AcceptedChristRepository],
})
export class AcceptedChristsModule {}
