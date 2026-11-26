import { FeatureFlagAudience } from '../types';

/** Resumo do acervo de flags, para o cabeçalho do painel. */
export class FeatureFlagStatsDto {
  total: number;
  enabled: number;
  disabled: number;
  /** Quantas flags há em cada combinação de público. */
  byAudience: Record<FeatureFlagAudience, number>;
}
