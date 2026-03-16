/**
 * Automação para criar Feature Flags no sistema Clubinho NIB
 *
 * Uso:
 *   node scripts/automations/feature-flags/create.js
 *
 * Variáveis de ambiente:
 *   - FEATURE_FLAGS_CATEGORY: Categoria específica para criar flags (opcional)
 *   - FEATURE_FLAGS_ENABLED_ONLY: Se '1', cria apenas flags que devem estar habilitadas
 *   - FEATURE_FLAGS_DISABLED_ONLY: Se '1', cria apenas flags que devem estar desabilitadas
 *   - FEATURE_FLAGS_DRY_RUN: Se '1', apenas mostra o que seria criado sem criar de fato
 *   - FEATURE_FLAGS_SKIP_EXISTING: Se '1', ignora flags que já existem (default: true)
 *   - ENVIRONMENT: Ambiente para as flags (development, staging, production)
 */

const { getAllFlags, getFlagsByCategory, getCategories, getTotalFlagsCount } = require('./flags-definition');

async function createFeatureFlags({ http, logger, flags, dryRun = false, skipExisting = true, environment = null }) {
  const created = [];
  const skipped = [];
  const failed = [];

  for (const flag of flags) {
    const dto = {
      key: flag.key,
      name: flag.name,
      description: flag.description,
      enabled: flag.enabled,
      environment: environment || null,
      metadata: flag.metadata || { category: flag.category },
    };

    if (dryRun) {
      logger.info(`[DRY-RUN] Would create: ${flag.key} (enabled: ${flag.enabled})`);
      created.push(dto);
      continue;
    }

    try {
      const res = await http.request('post', '/feature-flags', { data: dto });
      created.push(res.data);
      logger.info(`[feature-flags/create] Created: ${flag.key} (enabled: ${flag.enabled})`);
    } catch (e) {
      const errorMsg = e.response?.data?.message || e.message;

      if (skipExisting && errorMsg.includes('already exists')) {
        skipped.push(flag.key);
        logger.debug(`[feature-flags/create] Skipped (exists): ${flag.key}`);
      } else {
        failed.push({ key: flag.key, error: errorMsg });
        logger.warn(`[feature-flags/create] Failed: ${flag.key} - ${errorMsg}`);
      }
    }
  }

  return { created, skipped, failed };
}

async function run({ http, logger, ctx }) {
  const category = process.env.FEATURE_FLAGS_CATEGORY || ctx?.category;
  const enabledOnly = process.env.FEATURE_FLAGS_ENABLED_ONLY === '1';
  const disabledOnly = process.env.FEATURE_FLAGS_DISABLED_ONLY === '1';
  const dryRun = process.env.FEATURE_FLAGS_DRY_RUN === '1';
  const skipExisting = process.env.FEATURE_FLAGS_SKIP_EXISTING !== '0';
  const environment = process.env.ENVIRONMENT || ctx?.environment || null;

  logger.info('='.repeat(60));
  logger.info('[feature-flags/create] Iniciando criação de Feature Flags');
  logger.info('='.repeat(60));

  let flags;
  if (category) {
    flags = getFlagsByCategory(category);
    if (flags.length === 0) {
      logger.warn(`[feature-flags/create] Categoria não encontrada: ${category}`);
      logger.info(`[feature-flags/create] Categorias disponíveis: ${getCategories().join(', ')}`);
      return { ok: false, error: `Categoria não encontrada: ${category}` };
    }
    logger.info(`[feature-flags/create] Criando flags da categoria: ${category}`);
  } else {
    flags = getAllFlags();
    logger.info(`[feature-flags/create] Criando TODAS as flags`);
  }

  if (enabledOnly) {
    flags = flags.filter((f) => f.enabled === true);
    logger.info(`[feature-flags/create] Filtro: apenas flags habilitadas`);
  } else if (disabledOnly) {
    flags = flags.filter((f) => f.enabled === false);
    logger.info(`[feature-flags/create] Filtro: apenas flags desabilitadas`);
  }

  logger.info(`[feature-flags/create] Total de flags a processar: ${flags.length}`);
  logger.info(`[feature-flags/create] Ambiente: ${environment || 'global (null)'}`);
  logger.info(`[feature-flags/create] Dry-run: ${dryRun ? 'SIM' : 'NÃO'}`);
  logger.info(`[feature-flags/create] Skip existing: ${skipExisting ? 'SIM' : 'NÃO'}`);
  logger.info('-'.repeat(60));

  if (flags.length === 0) {
    logger.warn('[feature-flags/create] Nenhuma flag para criar!');
    return { ok: true, created: [], skipped: [], failed: [] };
  }

  const result = await createFeatureFlags({
    http,
    logger,
    flags,
    dryRun,
    skipExisting,
    environment,
  });

  logger.info('-'.repeat(60));
  logger.info(`[feature-flags/create] Resumo:`);
  logger.info(`  - Criadas: ${result.created.length}`);
  logger.info(`  - Ignoradas (já existem): ${result.skipped.length}`);
  logger.info(`  - Falhas: ${result.failed.length}`);

  if (result.failed.length > 0) {
    logger.warn('[feature-flags/create] Flags que falharam:');
    result.failed.forEach(({ key, error }) => {
      logger.warn(`  - ${key}: ${error}`);
    });
  }

  logger.info('='.repeat(60));
  logger.info('[feature-flags/create] Concluído!');
  logger.info('='.repeat(60));

  return { ok: true, ...result };
}

module.exports = { run, createFeatureFlags };
