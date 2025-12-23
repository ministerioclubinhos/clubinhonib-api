async function run({ logger }) {
  // Não existe GET no controller atual.
  logger.info('[accepted-christs/list-fix] N/A (controller não expõe GET)');
  return { ok: true, skipped: true };
}

module.exports = { run };


