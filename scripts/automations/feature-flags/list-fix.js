/**
 * Automação para listar e corrigir Feature Flags no sistema Clubinho NIB
 *
 * Este script verifica as flags existentes no banco de dados e compara
 * com as definições no arquivo flags-definition.js, permitindo:
 * - Listar todas as flags existentes
 * - Identificar flags que estão no banco mas não na definição
 * - Identificar flags que estão na definição mas não no banco
 * - Sincronizar/corrigir flags
 *
 * Variáveis de ambiente:
 *   - FEATURE_FLAGS_SYNC: Se '1', sincroniza as flags (cria faltantes, pode excluir órfãs)
 *   - FEATURE_FLAGS_DELETE_ORPHANS: Se '1', exclui flags órfãs (não definidas)
 *   - FEATURE_FLAGS_UPDATE_EXISTING: Se '1', atualiza flags existentes com novos valores
 */

const { getAllFlags } = require('./flags-definition');

async function listExistingFlags({ http, logger }) {
  try {
    const res = await http.request('get', '/feature-flags');
    return res.data || [];
  } catch (e) {
    logger.error(`[feature-flags/list-fix] Erro ao listar flags: ${e.response?.data?.message || e.message}`);
    return [];
  }
}

async function deleteFlag({ http, logger, key }) {
  try {
    await http.request('delete', `/feature-flags/${key}`);
    logger.info(`[feature-flags/list-fix] Excluída: ${key}`);
    return true;
  } catch (e) {
    logger.warn(`[feature-flags/list-fix] Erro ao excluir ${key}: ${e.response?.data?.message || e.message}`);
    return false;
  }
}

async function updateFlag({ http, logger, key, dto }) {
  try {
    await http.request('patch', `/feature-flags/${key}`, { data: dto });
    logger.info(`[feature-flags/list-fix] Atualizada: ${key}`);
    return true;
  } catch (e) {
    logger.warn(`[feature-flags/list-fix] Erro ao atualizar ${key}: ${e.response?.data?.message || e.message}`);
    return false;
  }
}

async function createFlag({ http, logger, flag, environment }) {
  const dto = {
    key: flag.key,
    name: flag.name,
    description: flag.description,
    enabled: flag.enabled,
    environment: environment || null,
    metadata: flag.metadata || { category: flag.category },
  };

  try {
    await http.request('post', '/feature-flags', { data: dto });
    logger.info(`[feature-flags/list-fix] Criada: ${flag.key}`);
    return true;
  } catch (e) {
    logger.warn(`[feature-flags/list-fix] Erro ao criar ${flag.key}: ${e.response?.data?.message || e.message}`);
    return false;
  }
}

async function run({ http, logger, ctx }) {
  const sync = process.env.FEATURE_FLAGS_SYNC === '1';
  const deleteOrphans = process.env.FEATURE_FLAGS_DELETE_ORPHANS === '1';
  const updateExisting = process.env.FEATURE_FLAGS_UPDATE_EXISTING === '1';
  const environment = process.env.ENVIRONMENT || ctx?.environment || null;

  logger.info('='.repeat(60));
  logger.info('[feature-flags/list-fix] Verificação de Feature Flags');
  logger.info('='.repeat(60));

  const existingFlags = await listExistingFlags({ http, logger });
  const existingKeys = new Set(existingFlags.map((f) => f.key));

  const definedFlags = getAllFlags();
  const definedKeys = new Set(definedFlags.map((f) => f.key));

  logger.info(`[feature-flags/list-fix] Flags no banco: ${existingFlags.length}`);
  logger.info(`[feature-flags/list-fix] Flags definidas: ${definedFlags.length}`);
  logger.info('-'.repeat(60));

  const missingInDb = definedFlags.filter((f) => !existingKeys.has(f.key));
  const orphansInDb = existingFlags.filter((f) => !definedKeys.has(f.key));
  const inBoth = existingFlags.filter((f) => definedKeys.has(f.key));

  logger.info(`[feature-flags/list-fix] Análise:`);
  logger.info(`  - Faltando no banco: ${missingInDb.length}`);
  logger.info(`  - Órfãs no banco (não definidas): ${orphansInDb.length}`);
  logger.info(`  - Em ambos: ${inBoth.length}`);

  if (missingInDb.length > 0) {
    logger.info('\n[feature-flags/list-fix] Flags FALTANDO no banco:');
    missingInDb.forEach((f) => logger.info(`  - ${f.key} (${f.name})`));
  }

  if (orphansInDb.length > 0) {
    logger.info('\n[feature-flags/list-fix] Flags ÓRFÃS no banco (não definidas):');
    orphansInDb.forEach((f) => logger.info(`  - ${f.key} (${f.name})`));
  }

  logger.info('\n[feature-flags/list-fix] Status das flags existentes:');
  const enabled = existingFlags.filter((f) => f.enabled).length;
  const disabled = existingFlags.filter((f) => !f.enabled).length;
  logger.info(`  - Habilitadas: ${enabled}`);
  logger.info(`  - Desabilitadas: ${disabled}`);

  const byCategory = {};
  for (const flag of existingFlags) {
    const category = flag.metadata?.category || 'unknown';
    byCategory[category] = byCategory[category] || [];
    byCategory[category].push(flag);
  }

  if (Object.keys(byCategory).length > 0) {
    logger.info('\n[feature-flags/list-fix] Distribuição por categoria:');
    for (const [category, flags] of Object.entries(byCategory).sort()) {
      const enabledCount = flags.filter((f) => f.enabled).length;
      logger.info(`  - ${category}: ${flags.length} flags (${enabledCount} habilitadas)`);
    }
  }

  let syncResults = { created: 0, deleted: 0, updated: 0 };

  if (sync) {
    logger.info('\n' + '-'.repeat(60));
    logger.info('[feature-flags/list-fix] Iniciando sincronização...');

    for (const flag of missingInDb) {
      const success = await createFlag({ http, logger, flag, environment });
      if (success) syncResults.created++;
    }

    if (deleteOrphans) {
      for (const flag of orphansInDb) {
        const success = await deleteFlag({ http, logger, key: flag.key });
        if (success) syncResults.deleted++;
      }
    }

    if (updateExisting) {
      for (const existingFlag of inBoth) {
        const definedFlag = definedFlags.find((f) => f.key === existingFlag.key);
        if (
          definedFlag &&
          (existingFlag.name !== definedFlag.name ||
            existingFlag.description !== definedFlag.description)
        ) {
          const success = await updateFlag({
            http,
            logger,
            key: existingFlag.key,
            dto: {
              name: definedFlag.name,
              description: definedFlag.description,
            },
          });
          if (success) syncResults.updated++;
        }
      }
    }

    logger.info('\n[feature-flags/list-fix] Resultados da sincronização:');
    logger.info(`  - Criadas: ${syncResults.created}`);
    logger.info(`  - Excluídas: ${syncResults.deleted}`);
    logger.info(`  - Atualizadas: ${syncResults.updated}`);
  } else {
    logger.info('\n[feature-flags/list-fix] Para sincronizar, execute com FEATURE_FLAGS_SYNC=1');
  }

  logger.info('\n' + '='.repeat(60));
  logger.info('[feature-flags/list-fix] Concluído!');
  logger.info('='.repeat(60));

  return {
    ok: true,
    existing: existingFlags.length,
    defined: definedFlags.length,
    missingInDb: missingInDb.length,
    orphansInDb: orphansInDb.length,
    syncResults,
  };
}

module.exports = { run, listExistingFlags };
