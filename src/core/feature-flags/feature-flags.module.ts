import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';

import { FeatureFlagsController } from './feature-flags.controller';
import { FeatureFlagsCoreModule } from './feature-flags-core.module';
import { CreateFeatureFlagService } from './services/create-feature-flag.service';
import { UpdateFeatureFlagService } from './services/update-feature-flag.service';
import { DeleteFeatureFlagService } from './services/delete-feature-flag.service';

@Module({
  /**
   * O repositório e a leitura vêm do módulo enxuto; aqui ficam só o controller
   * e as operações de escrita, que são as que precisam do `AuthModule`.
   */
  imports: [FeatureFlagsCoreModule, AuthModule],
  controllers: [FeatureFlagsController],
  providers: [
    CreateFeatureFlagService,
    UpdateFeatureFlagService,
    DeleteFeatureFlagService,
  ],
  /**
   * O serviço de leitura sai do módulo para quem precisar consultar uma flag
   * no servidor. A decisão de mostrar ou esconder acontece na aplicação: o
   * back apenas informa, por `/feature-flags/map`, o que vale para a sessão.
   *
   * Quem sai daqui é o módulo enxuto, e não o serviço: o serviço é provider
   * dele, não deste, e o Nest recusa exportar provider de outro módulo.
   */
  exports: [FeatureFlagsCoreModule],
})
export class FeatureFlagsModule {}
