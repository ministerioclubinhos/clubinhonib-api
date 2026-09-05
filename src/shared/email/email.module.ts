import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { FeatureFlagsCoreModule } from 'src/core/feature-flags/feature-flags-core.module';
import { SmtpModule } from 'src/shared/providers/smtp/smtp.module';
import { SiteUrlModule } from 'src/shared/site-url/site-url.module';
import { EmailService } from './email.service';
import { UnsubscribeTokenService } from './unsubscribe-token.service';

/**
 * O e-mail depende da **leitura** das flags, e não do módulo completo: o
 * `FeatureFlagsModule` traz o controller e, com ele, o `AuthModule`, que já
 * depende deste módulo. Importar o módulo enxuto é o que mantém o grafo sem
 * ciclo e sem `forwardRef`.
 */
@Module({
  imports: [ConfigModule, SmtpModule, SiteUrlModule, FeatureFlagsCoreModule],
  providers: [EmailService, UnsubscribeTokenService],
  exports: [EmailService, UnsubscribeTokenService],
})
export class EmailModule {}
