/** Smoke do site não cria nada; consome o que os demais módulos criaram. */
async function run({ logger }) {
  logger.section('site-smoke/create');
  logger.info('[site-smoke/create] N/A (somente leitura das rotas públicas)');
  return { ok: true, skipped: true };
}

module.exports = { run };
