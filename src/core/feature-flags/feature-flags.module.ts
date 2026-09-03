import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { AuthModule } from '../auth/auth.module';

import { FeatureFlagEntity } from './entities/feature-flag.entity';
import { FeatureFlagsRepository } from './feature-flags.repository';
import { FeatureFlagsController } from './feature-flags.controller';
import { CreateFeatureFlagService } from './services/create-feature-flag.service';
import { GetFeatureFlagsService } from './services/get-feature-flags.service';
import { UpdateFeatureFlagService } from './services/update-feature-flag.service';
import { DeleteFeatureFlagService } from './services/delete-feature-flag.service';

@Module({
  imports: [TypeOrmModule.forFeature([FeatureFlagEntity]), AuthModule],
  controllers: [FeatureFlagsController],
  providers: [
    FeatureFlagsRepository,
    CreateFeatureFlagService,
    GetFeatureFlagsService,
    UpdateFeatureFlagService,
    DeleteFeatureFlagService,
  ],
  /**
   * O serviço de leitura sai do módulo para quem precisar consultar uma flag
   * no servidor. A decisão de mostrar ou esconder acontece na aplicação: o
   * back apenas informa, por `/feature-flags/map`, o que vale para a sessão.
   */
  exports: [GetFeatureFlagsService],
})
export class FeatureFlagsModule {}
