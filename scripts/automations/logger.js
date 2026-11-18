/**
 * Logger das automações com um placar de resultados.
 *
 * Cada `ok`/`warn`/`fail` conta para o resumo impresso no fim do `run-all`; o
 * `check` embrulha um cenário para que uma falha não derrube a suíte inteira.
 */
const { errorMessage } = require('./common/errors');

function createLogger({ quiet = false } = {}) {
  const summary = { ok: 0, warn: 0, fail: 0, failures: [] };
  const ts = () => new Date().toISOString();

  const logger = {
    summary,
    info: (msg) => !quiet && console.log(`${ts()} INFO  ${msg}`),
    ok: (msg) => {
      summary.ok += 1;
      if (!quiet) console.log(`${ts()} OK    ${msg}`);
    },
    warn: (msg) => {
      summary.warn += 1;
      console.warn(`${ts()} WARN  ${msg}`);
    },
    error: (msg) => {
      summary.fail += 1;
      summary.failures.push(msg);
      console.error(`${ts()} ERROR ${msg}`);
    },
    section: (title) => !quiet && console.log(`\n${ts()} ===== ${title} =====`),

    /**
     * Roda um cenário. Sucesso vira `ok`; erro vira `error` (ou `warn` quando
     * `soft`), sem interromper o restante.
     */
    async check(label, fn, { soft = false } = {}) {
      try {
        const result = await fn();
        logger.ok(label + (typeof result === 'string' ? ` ${result}` : ''));
        return { ok: true, result };
      } catch (e) {
        const text = `${label}: ${errorMessage(e)}`;
        if (soft) logger.warn(text);
        else logger.error(text);
        return { ok: false, error: e };
      }
    },

    printSummary() {
      console.log(`\n${ts()} ===== RESUMO ===== ok=${summary.ok} warn=${summary.warn} fail=${summary.fail}`);
      for (const f of summary.failures) console.log(`  ✗ ${f}`);
    },
  };

  return logger;
}

module.exports = { createLogger };
