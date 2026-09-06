/** Estatísticas são somente leitura; os dados vêm dos módulos anteriores. */
async function run({ logger }) {
  logger.section('statistics/create');
  logger.info('[statistics/create] N/A (módulo somente leitura)');
  return { ok: true, skipped: true };
}

module.exports = { run };
