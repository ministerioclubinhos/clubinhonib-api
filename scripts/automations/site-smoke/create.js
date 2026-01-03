async function run({ logger }) {
  // A maioria dos controllers de conteúdo usa multipart com arquivos e/ou AdminRoleGuard.
  // Para "create" automático sem arquivos, marcamos como N/A por padrão.
  logger.info('[site-smoke/create] N/A (criações exigem multipart/arquivos).');
  return { ok: true, skipped: true };
}

module.exports = { run };


