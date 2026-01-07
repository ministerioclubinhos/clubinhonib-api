
const { runAll } = require('./automations/run-all');

runAll().catch((err) => {
  console.error('\n❌ Fatal error:', err?.message || err);
  console.error(err?.stack || '');
  process.exit(1);
});
