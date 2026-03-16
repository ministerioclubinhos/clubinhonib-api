#!/usr/bin/env node

/**
 * Script standalone para criar Feature Flags
 *
 * Uso:
 *   node scripts/automations/feature-flags/run.js [comando] [opções]
 *
 * Comandos:
 *   create     - Cria as feature flags (padrão)
 *   list       - Lista e verifica flags existentes
 *   sync       - Sincroniza flags (cria faltantes)
 *   categories - Lista categorias disponíveis
 *   count      - Conta total de flags definidas
 *
 * Variáveis de ambiente:
 *   API_BASE_URL             - URL base da API (default: http://localhost:3000)
 *   SUPERUSER_EMAIL          - Email do superusuário
 *   SUPERUSER_PASSWORD       - Senha do superusuário
 *   ENVIRONMENT              - Ambiente (development, staging, production)
 *   FEATURE_FLAGS_CATEGORY   - Categoria específica para criar flags
 *   FEATURE_FLAGS_DRY_RUN    - Se '1', apenas mostra o que seria criado
 *
 * Exemplos:
 *   node scripts/automations/feature-flags/run.js create
 *   node scripts/automations/feature-flags/run.js list
 *   FEATURE_FLAGS_CATEGORY=children node scripts/automations/feature-flags/run.js create
 *   FEATURE_FLAGS_DRY_RUN=1 node scripts/automations/feature-flags/run.js create
 */

const { createHttpClient } = require('../common/http');
const { getCategories, getTotalFlagsCount, getAllFlags, getFlagsByCategory } = require('./flags-definition');
const createModule = require('./create');
const listFixModule = require('./list-fix');

const logger = {
  info: (msg) => console.log(`[INFO] ${msg}`),
  warn: (msg) => console.warn(`[WARN] ${msg}`),
  error: (msg) => console.error(`[ERROR] ${msg}`),
  debug: (msg) => {
    if (process.env.DEBUG === '1') console.log(`[DEBUG] ${msg}`);
  },
};

async function main() {
  const command = process.argv[2] || 'create';

  if (command === 'categories') {
    console.log('\nCategorias disponíveis:');
    console.log('='.repeat(40));
    const categories = getCategories();
    categories.forEach((c) => {
      const flags = getFlagsByCategory(c);
      console.log(`  - ${c} (${flags.length} flags)`);
    });
    console.log('='.repeat(40));
    console.log(`Total: ${categories.length} categorias`);
    return;
  }

  if (command === 'count') {
    const total = getTotalFlagsCount();
    const categories = getCategories();
    console.log(`\nTotal de flags definidas: ${total}`);
    console.log(`Total de categorias: ${categories.length}`);
    return;
  }

  if (command === 'flags') {
    console.log('\nFlags definidas:');
    console.log('='.repeat(60));
    const flags = getAllFlags();
    flags.forEach((f) => {
      const status = f.enabled ? 'ON ' : 'OFF';
      console.log(`  [${status}] ${f.key} - ${f.name}`);
    });
    console.log('='.repeat(60));
    console.log(`Total: ${flags.length} flags`);
    return;
  }

  if (command === 'help' || command === '--help' || command === '-h') {
    console.log(`
Feature Flags Automation Script
===============================

Comandos:
  create     - Cria as feature flags no banco de dados
  list       - Lista e verifica flags existentes vs definidas
  sync       - Sincroniza flags (cria faltantes, atualiza existentes)
  categories - Lista categorias disponíveis
  flags      - Lista todas as flags definidas
  count      - Conta total de flags definidas
  help       - Mostra esta ajuda

Variáveis de ambiente:
  API_BASE_URL             - URL base da API (default: http://localhost:3000)
  SUPERUSER_EMAIL          - Email do superusuário
  SUPERUSER_PASSWORD       - Senha do superusuário
  ENVIRONMENT              - Ambiente das flags (development, staging, production)
  FEATURE_FLAGS_CATEGORY   - Criar flags apenas de uma categoria específica
  FEATURE_FLAGS_DRY_RUN    - Se '1', simula sem criar
  FEATURE_FLAGS_SYNC       - Se '1', sincroniza (list-fix)
  FEATURE_FLAGS_DELETE_ORPHANS - Se '1', exclui flags órfãs

Exemplos:
  # Criar todas as flags
  node scripts/automations/feature-flags/run.js create

  # Criar apenas flags da categoria children
  FEATURE_FLAGS_CATEGORY=children node scripts/automations/feature-flags/run.js create

  # Simular criação (dry-run)
  FEATURE_FLAGS_DRY_RUN=1 node scripts/automations/feature-flags/run.js create

  # Listar e verificar flags
  node scripts/automations/feature-flags/run.js list

  # Sincronizar flags
  FEATURE_FLAGS_SYNC=1 node scripts/automations/feature-flags/run.js list
`);
    return;
  }

  const http = createHttpClient();

  try {
    logger.info('Autenticando...');
    await http.login();
    logger.info('Autenticado com sucesso!');
  } catch (e) {
    logger.error(`Falha na autenticação: ${e.message}`);
    logger.error('Verifique as variáveis de ambiente SUPERUSER_EMAIL e SUPERUSER_PASSWORD');
    process.exit(1);
  }

  try {
    let result;

    switch (command) {
      case 'create':
        result = await createModule.run({ http, logger, ctx: {} });
        break;

      case 'list':
        result = await listFixModule.run({ http, logger, ctx: {} });
        break;

      case 'sync':
        process.env.FEATURE_FLAGS_SYNC = '1';
        result = await listFixModule.run({ http, logger, ctx: {} });
        break;

      default:
        logger.error(`Comando desconhecido: ${command}`);
        logger.info('Use "help" para ver os comandos disponíveis');
        process.exit(1);
    }

    if (result && !result.ok) {
      logger.error('Operação falhou');
      process.exit(1);
    }
  } catch (e) {
    logger.error(`Erro: ${e.message}`);
    if (e.response?.data) {
      logger.error(`Detalhes: ${JSON.stringify(e.response.data)}`);
    }
    process.exit(1);
  }
}

main().catch((e) => {
  console.error('Erro fatal:', e);
  process.exit(1);
});
