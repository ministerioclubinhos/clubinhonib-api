import { Injectable, Logger } from '@nestjs/common';

import { FeatureFlagsRepository } from '../feature-flags.repository';
import { GetFeatureFlagsService } from './get-feature-flags.service';

@Injectable()
export class DeleteFeatureFlagService {
  private readonly logger = new Logger(DeleteFeatureFlagService.name);

  constructor(
    private readonly repository: FeatureFlagsRepository,
    private readonly getService: GetFeatureFlagsService,
  ) {}

  async remove(key: string): Promise<void> {
    const flag = await this.getService.findEntityOrFail(key);

    await this.repository.remove(flag);
    this.getService.invalidate(key);
    this.logger.log(`Feature flag removida: ${key}`);
  }
}
