async function run({ logger }) {
  
  
  logger.info('[site-smoke/create] N/A (criações exigem multipart/arquivos).');
  return { ok: true, skipped: true };
}

module.exports = { run };


