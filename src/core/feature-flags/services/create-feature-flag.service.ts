import { Injectable, Logger, OnModuleInit } from '@nestjs/common';

import { AppBusinessException, ErrorCode } from 'src/shared/exceptions';

import { FeatureFlagsRepository } from '../feature-flags.repository';
import { CreateFeatureFlagDto } from '../dto/create-feature-flag.dto';
import { FeatureFlagResponseDto } from '../dto/feature-flag-response.dto';
import { FeatureFlagEntity } from '../entities/feature-flag.entity';
import { toFeatureFlagResponse, toFeatureFlagResponseList } from '../mappers';
import { normalizeTargetRoles } from '../utils';
import { DEFAULT_FEATURE_FLAGS, RETIRED_FEATURE_FLAGS } from '../constants';
import { GetFeatureFlagsService } from './get-feature-flags.service';

@Injectable()
export class CreateFeatureFlagService implements OnModuleInit {
  private readonly logger = new Logger(CreateFeatureFlagService.name);

  constructor(
    private readonly repository: FeatureFlagsRepository,
    private readonly getService: GetFeatureFlagsService,
  ) {}

  /**
   * Acerta o catálogo no boot: cria as flags de fábrica que faltam e remove as
   * aposentadas.
   *
   * A falha é registrada e engolida de propósito: uma carga de flags não pode
   * impedir a API de subir.
   */
  async onModuleInit(): Promise<void> {
    try {
      await this.synchronizeCatalog();
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.warn(`Falha ao acertar as feature flags: ${message}`);
    }
  }

  /** Cria o que falta e apaga o que foi aposentado. */
  async synchronizeCatalog(): Promise<{
    created: FeatureFlagResponseDto[];
    retired: string[];
  }> {
    return {
      created: await this.seedDefaults(),
      retired: await this.retireLegacyFlags(),
    };
  }

  /**
   * Apaga as chaves aposentadas.
   *
   * Só as listadas em `RETIRED_FEATURE_FLAGS` saem: uma flag criada no painel
   * pela administração não é tocada.
   */
  async retireLegacyFlags(): Promise<string[]> {
    const retired: string[] = [];

    for (const key of RETIRED_FEATURE_FLAGS) {
      const existing = await this.repository.findByKey(key);
      if (!existing) continue;

      await this.repository.remove(existing);
      retired.push(key);
      this.logger.log(`Feature flag aposentada removida: ${key}`);
    }

    if (retired.length > 0) this.getService.invalidateAll();

    return retired;
  }

  async create(dto: CreateFeatureFlagDto): Promise<FeatureFlagResponseDto> {
    const existing = await this.repository.findByKey(dto.key);

    if (existing) {
      throw new AppBusinessException(
        ErrorCode.RESOURCE_CONFLICT,
        `Já existe uma feature flag com a chave "${dto.key}"`,
      );
    }

    const flag = this.repository.create({
      key: dto.key,
      name: dto.name,
      description: dto.description,
      enabled: dto.enabled ?? false,
      // A lista é gravada normalizada: é ela que define a combinação de
      // público, e comparar combinações exige uma ordem estável.
      targetRoles: normalizeTargetRoles(dto.targetRoles),
      metadata: dto.metadata,
    });

    const saved = await this.repository.save(flag);
    this.getService.invalidate(saved.key);
    this.logger.log(`Feature flag criada: ${saved.key}`);

    return toFeatureFlagResponse(saved);
  }

  /**
   * Cria as flags de fábrica que ainda não existem.
   *
   * Uma flag já cadastrada não é sobrescrita: o que a administração ajustou no
   * painel vale mais do que o padrão do código.
   */
  async seedDefaults(): Promise<FeatureFlagResponseDto[]> {
    const created: FeatureFlagEntity[] = [];

    for (const definition of DEFAULT_FEATURE_FLAGS) {
      const existing = await this.repository.findByKey(definition.key);
      if (existing) continue;

      const flag = this.repository.create({
        key: definition.key,
        name: definition.name,
        description: definition.description,
        enabled: definition.enabled,
        targetRoles: normalizeTargetRoles(definition.targetRoles),
      });

      created.push(await this.repository.save(flag));
      this.logger.log(`Feature flag de fábrica criada: ${definition.key}`);
    }

    if (created.length > 0) this.getService.invalidateAll();

    return toFeatureFlagResponseList(created);
  }
}
