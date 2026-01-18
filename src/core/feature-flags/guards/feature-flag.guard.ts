import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { FeatureFlagsService } from '../feature-flags.service';
import { FEATURE_FLAG_KEY } from '../decorators/feature-flag.decorator';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class FeatureFlagGuard implements CanActivate {
    constructor(
        private reflector: Reflector,
        private featureFlagsService: FeatureFlagsService,
        private configService: ConfigService,
    ) { }

    async canActivate(context: ExecutionContext): Promise<boolean> {
        const featureFlagKey = this.reflector.get<string>(FEATURE_FLAG_KEY, context.getHandler());

        if (!featureFlagKey) {
            return true;
        }

        const environment = this.configService.get<string>('ENVIRONMENT');
        const isEnabled = await this.featureFlagsService.isEnabled(featureFlagKey, environment);

        if (!isEnabled) {
            throw new ForbiddenException(
                `Feature "${featureFlagKey}" is not enabled in ${environment || 'current'} environment`
            );
        }

        return true;
    }
}
