import { Injectable, Logger } from '@nestjs/common';

import { AppBusinessException, ErrorCode } from 'src/shared/exceptions';

import { FeatureFlagsRepository } from '../feature-flags.repository';
import { UpdateFeatureFlagDto } from '../dto/update-feature-flag.dto';
import { FeatureFlagResponseDto } from '../dto/feature-flag-response.dto';
import { toFeatureFlagResponse } from '../mappers';
import { normalizeTargetRoles } from '../utils';
import { GetFeatureFlagsService } from './get-feature-flags.service';

@Injectable()
export class UpdateFeatureFlagService {
  private readonly logger = new Logger(UpdateFeatureFlagService.name);

  constructor(
    private readonly repository: FeatureFlagsRepository,
    private readonly getService: GetFeatureFlagsService,
  ) {}

  async update(
    key: string,
    dto: UpdateFeatureFlagDto,
  ): Promise<FeatureFlagResponseDto> {
    const flag = await this.getService.findEntityOrFail(key);

    // A chave é editável, mas continua sendo única e é o que o código procura:
    // renomear uma flag em uso desliga o recurso até o código apontar para a
    // chave nova.
    if (dto.key !== undefined && dto.key !== flag.key) {
      const conflicting = await this.repository.findByKey(dto.key);

      if (conflicting) {
        throw new AppBusinessException(
          ErrorCode.RESOURCE_CONFLICT,
          `Já existe uma feature flag com a chave "${dto.key}"`,
        );
      }

      flag.key = dto.key;
    }

    // Só o que veio no corpo é tocado: a edição parcial não pode apagar o que
    // a tela não enviou.
    if (dto.name !== undefined) flag.name = dto.name;
    if (dto.description !== undefined) flag.description = dto.description;
    if (dto.enabled !== undefined) flag.enabled = dto.enabled;
    if (dto.metadata !== undefined) flag.metadata = dto.metadata;
    if (dto.targetRoles !== undefined) {
      flag.targetRoles = normalizeTargetRoles(dto.targetRoles);
    }

    const saved = await this.repository.save(flag);

    // As duas chaves saem do cache: a antiga, que some, e a nova, que passa a
    // valer.
    this.getService.invalidate(key);
    if (saved.key !== key) this.getService.invalidate(saved.key);

    this.logger.log(
      saved.key === key
        ? `Feature flag atualizada: ${key}`
        : `Feature flag renomeada: ${key} → ${saved.key}`,
    );

    return toFeatureFlagResponse(saved);
  }

  /** Liga ou desliga a flag, sem mexer no resto. */
  async toggle(key: string): Promise<FeatureFlagResponseDto> {
    const flag = await this.getService.findEntityOrFail(key);

    flag.enabled = !flag.enabled;
    const saved = await this.repository.save(flag);

    this.getService.invalidate(key);
    this.logger.log(
      `Feature flag ${saved.enabled ? 'ligada' : 'desligada'}: ${key}`,
    );

    return toFeatureFlagResponse(saved);
  }
}
