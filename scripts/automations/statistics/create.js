async function run({ logger }) {
  
  logger.info('[statistics/create] N/A (statistics é read-only)');
  return { ok: true, skipped: true };
}

module.exports = { run };


