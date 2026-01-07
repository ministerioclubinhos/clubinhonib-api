
const { runAll } = require('./automations/run-all');

runAll().catch((err) => {
  console.error('\n❌ Erro fatal:', err?.message || err);
  console.error(err?.stack || '');
  process.exit(1);
});
