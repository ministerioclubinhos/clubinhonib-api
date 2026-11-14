/**
 * Leitura uniforme dos erros da API.
 *
 * A API responde `{ success: false, error: { code, message, details } }`; o
 * axios embrulha isso em `e.response.data`, e o `fetch` do multipart em
 * `e.data`. Aqui os dois caminhos viram uma frase só.
 */
function errorStatus(e) {
  return e?.response?.status ?? e?.status ?? null;
}

function errorCode(e) {
  const data = e?.response?.data ?? e?.data;
  return data?.error?.code ?? data?.code ?? null;
}

function errorMessage(e) {
  const data = e?.response?.data ?? e?.data;
  const msg = data?.error?.message ?? data?.message ?? null;
  const details = data?.error?.details;
  const detailText =
    details && typeof details === 'object' && !Array.isArray(details)
      ? Object.values(details).flat().join('; ')
      : Array.isArray(details)
        ? details.join('; ')
        : '';
  const base = Array.isArray(msg) ? msg.join('; ') : msg;
  const status = errorStatus(e);
  const code = errorCode(e);
  const head = [status ? `HTTP ${status}` : null, code].filter(Boolean).join(' ');
  const body = [base, detailText].filter(Boolean).join(' | ') || e?.message || String(e);
  return head ? `${head} - ${body}` : body;
}

/**
 * Executa `fn` esperando um erro HTTP com um dos status informados. Devolve
 * `true` quando o erro esperado aconteceu; lança quando a chamada passou ou
 * falhou com outro status — os dois casos são bug de contrato.
 */
async function expectHttpError(fn, statuses, label = '') {
  const expected = Array.isArray(statuses) ? statuses : [statuses];
  try {
    await fn();
  } catch (e) {
    const status = errorStatus(e);
    if (expected.includes(status)) return true;
    throw new Error(`${label} esperava HTTP ${expected.join('/')} mas veio: ${errorMessage(e)}`);
  }
  throw new Error(`${label} esperava HTTP ${expected.join('/')} mas a chamada passou`);
}

module.exports = { errorStatus, errorCode, errorMessage, expectHttpError };
