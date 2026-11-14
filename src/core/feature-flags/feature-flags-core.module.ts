import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { FeatureFlagEntity } from './entities/feature-flag.entity';
import { FeatureFlagsRepository } from './feature-flags.repository';
import { GetFeatureFlagsService } from './services/get-feature-flags.service';

/**
 * A leitura das flags, sem nada de HTTP.
 *
 * É o mesmo módulo de domínio das flags, partido em dois por causa do grafo de
 * injeção: `FeatureFlagsModule` precisa do `AuthModule` para os guards do
 * controller, e o `AuthModule` já depende do `EmailModule`. Se o e-mail
 * importasse o módulo inteiro para consultar uma flag, o ciclo se fecharia e a
 * saída seria um `forwardRef`, que o guia do repositório trata como último
 * recurso.
 *
 * Quem só precisa perguntar "esta flag está ligada?" importa este módulo.
 */
@Module({
  imports: [TypeOrmModule.forFeature([FeatureFlagEntity])],
  providers: [FeatureFlagsRepository, GetFeatureFlagsService],
  exports: [FeatureFlagsRepository, GetFeatureFlagsService],
})
export class FeatureFlagsCoreModule {}
