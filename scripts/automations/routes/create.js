/** Rotas são geradas pelas páginas de conteúdo; o controller só tem GET. */
async function run({ logger }) {
  logger.section('routes/create');
  logger.info('[routes/create] N/A (rotas nascem das páginas: galerias, vídeos, materiais, meditações, documentos)');
  return { ok: true, skipped: true };
}

module.exports = { run };
