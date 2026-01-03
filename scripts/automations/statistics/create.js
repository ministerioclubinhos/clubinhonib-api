async function run({ logger }) {
  // Não há POST/PUT no controller de statistics; é read-only.
  logger.info('[statistics/create] N/A (statistics é read-only)');
  return { ok: true, skipped: true };
}

module.exports = { run };


