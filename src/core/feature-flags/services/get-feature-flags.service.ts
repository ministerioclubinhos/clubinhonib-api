import { Injectable, Logger } from '@nestjs/common';

import { UserRole } from 'src/core/auth/auth.types';
import { Paginated } from 'src/shared/dto/paginated.dto';
import { AppNotFoundException, ErrorCode } from 'src/shared/exceptions';

import { FeatureFlagsRepository } from '../feature-flags.repository';
import { FeatureFlagEntity } from '../entities/feature-flag.entity';
import { FeatureFlagResponseDto } from '../dto/feature-flag-response.dto';
import { FeatureFlagStatsDto } from '../dto/feature-flag-stats.dto';
import { QueryFeatureFlagsDto } from '../dto/query-feature-flags.dto';
import { toFeatureFlagResponse } from '../mappers';
import { audienceOfRoles, isTargetedForRole, targetRolesOf } from '../utils';
import {
  FEATURE_FLAGS_CACHE_TTL,
  FEATURE_FLAGS_DEFAULT_LIMIT,
  FEATURE_FLAGS_DEFAULT_PAGE,
  FEATURE_FLAG_AUDIENCES,
} from '../constants';
import { FeatureFlagAudience } from '../types';

@Injectable()
export class GetFeatureFlagsService {
  private readonly logger = new Logger(GetFeatureFlagsService.name);

  /** Resultado de `isEnabled` por chave e perfil, com validade curta. */
  private readonly cache = new Map<
    string,
    { enabled: boolean; timestamp: number }
  >();

  constructor(private readonly repository: FeatureFlagsRepository) {}

  /** Carrega a flag ou falha com o erro documentado. */
  async findEntityOrFail(key: string): Promise<FeatureFlagEntity> {
    const flag = await this.repository.findByKey(key);

    if (!flag) {
      this.logger.warn(`Feature flag não encontrada: ${key}`);
      throw new AppNotFoundException(
        ErrorCode.RESOURCE_NOT_FOUND,
        `Feature flag "${key}" não encontrada`,
      );
    }

    return flag;
  }

  async findOne(key: string): Promise<FeatureFlagResponseDto> {
    return toFeatureFlagResponse(await this.findEntityOrFail(key));
  }

  /**
   * Página da listagem administrativa.
   *
   * O recorte por combinação de perfis é aplicado aqui, e não no SQL: os
   * perfis alvo vivem numa coluna JSON com listas fora de ordem e grafias
   * antigas, então a comparação precisa acontecer sobre a lista normalizada.
   * Quando esse filtro está em uso, a página é recortada depois — do
   * contrário o total e o tamanho da página sairiam errados.
   */
  async findAllPaginated(
    query: QueryFeatureFlagsDto,
  ): Promise<Paginated<FeatureFlagResponseDto>> {
    const page = query.page ?? FEATURE_FLAGS_DEFAULT_PAGE;
    const limit = query.limit ?? FEATURE_FLAGS_DEFAULT_LIMIT;

    if (query.audience) {
      const all = await this.repository.findAllFiltered(query);
      const matching = all.filter(
        (flag) => audienceOfRoles(targetRolesOf(flag)) === query.audience,
      );
      const start = (page - 1) * limit;

      return {
        data: matching.slice(start, start + limit).map(toFeatureFlagResponse),
        total: matching.length,
        page,
        limit,
        pageCount: Math.ceil(matching.length / limit),
      };
    }

    const { items, total } = await this.repository.findAllPaginated(query);

    return {
      data: items.map(toFeatureFlagResponse),
      total,
      page,
      limit,
      pageCount: Math.ceil(total / limit),
    };
  }

  /**
   * Resumo do acervo: quantas flags existem, quantas estão ligadas e como
   * elas se distribuem entre as combinações de público.
   *
   * A contagem é feita sobre os perfis normalizados, pelo mesmo motivo do
   * recorte por audiência.
   */
  async getStats(): Promise<FeatureFlagStatsDto> {
    const flags = await this.repository.findAll();

    const byAudience = Object.fromEntries(
      FEATURE_FLAG_AUDIENCES.map((audience) => [audience, 0]),
    ) as Record<FeatureFlagAudience, number>;

    let enabled = 0;
    for (const flag of flags) {
      if (flag.enabled) enabled += 1;
      byAudience[audienceOfRoles(targetRolesOf(flag))] += 1;
    }

    return {
      total: flags.length,
      enabled,
      disabled: flags.length - enabled,
      byAudience,
    };
  }

  /**
   * As flags que valem para um perfil, no formato `{ chave: ligada }`.
   *
   * É o que a aplicação consome: o perfil vem da sessão de quem pergunta, e
   * uma flag restrita a outro perfil chega como `false`.
   */
  async getFlagsMap(role?: UserRole | null): Promise<Record<string, boolean>> {
    const flags = await this.repository.findAll();

    const map: Record<string, boolean> = {};
    for (const flag of flags) {
      map[flag.key] = isTargetedForRole(flag, role);
    }

    return map;
  }

  /** True quando a flag vale para o perfil informado. */
  async isEnabled(key: string, role?: UserRole | null): Promise<boolean> {
    const cacheKey = `${key}:${role ?? 'anonymous'}`;
    const cached = this.cache.get(cacheKey);

    if (cached && Date.now() - cached.timestamp < FEATURE_FLAGS_CACHE_TTL) {
      return cached.enabled;
    }

    const flag = await this.repository.findByKey(key);
    const enabled = flag ? isTargetedForRole(flag, role) : false;

    this.cache.set(cacheKey, { enabled, timestamp: Date.now() });
    return enabled;
  }

  /** Esquece o que estava guardado sobre uma chave. */
  invalidate(key: string): void {
    for (const cacheKey of this.cache.keys()) {
      if (cacheKey.startsWith(`${key}:`)) this.cache.delete(cacheKey);
    }
  }

  /** Esquece tudo; usado depois de uma carga em lote. */
  invalidateAll(): void {
    this.cache.clear();
  }
}
