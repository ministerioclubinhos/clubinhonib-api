async function run({ logger }) {
  
  logger.info('[accepted-christs/list-fix] N/A (controller não expõe GET)');
  return { ok: true, skipped: true };
}

module.exports = { run };


