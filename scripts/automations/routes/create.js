async function run({ logger }) {
  logger.info('[routes/create] N/A (controller só tem GET)');
  return { ok: true, skipped: true };
}

module.exports = { run };


