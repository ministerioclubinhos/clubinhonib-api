/**
 * Apoio comum das automações de edição (`update.js`).
 *
 * Cada módulo edita uma entidade criada na própria rodada, confere a
 * persistência relendo pela API e cobre os erros de contrato da edição:
 * corpo inválido, id inexistente, id fora do formato, papel sem permissão e
 * sessão ausente.
 */
const { expectHttpError } = require('./errors');

const MISSING_ID = '00000000-0000-4000-8000-000000000000';

/** Confere que cada campo esperado veio igual na resposta/leitura. */
function expectFields(actual, expected, label = '') {
  for (const [key, value] of Object.entries(expected)) {
    const got = actual?.[key];
    const same = JSON.stringify(got) === JSON.stringify(value);
    if (!same) throw new Error(`${label} campo "${key}": esperado ${JSON.stringify(value)}, veio ${JSON.stringify(got)}`);
  }
}

/**
 * Os erros de contrato padrão de uma rota de edição.
 *
 * `edit(client, id, body)` executa a edição; `validBody` é um corpo aceito e
 * `invalidBodies` uma lista de corpos que devem responder 400/422.
 */
async function runEditContractChecks({ logger, as, http, label, edit, validBody, invalidBodies = [], forbiddenRoles = [], notFoundStatus = 404, invalidIdStatus = [400, 422] }) {
  for (const body of invalidBodies) {
    await logger.check(`${label} corpo inválido ${JSON.stringify(body).slice(0, 60)} responde 400/422`, () =>
      expectHttpError(() => edit(http, edit.sampleId, body), [400, 422], `${label} inválido`),
    );
  }
  await logger.check(`${label} id inexistente responde ${notFoundStatus}`, () =>
    expectHttpError(() => edit(http, MISSING_ID, validBody), notFoundStatus, `${label} 404`),
  );
  await logger.check(`${label} id fora do formato responde 400/422`, () =>
    expectHttpError(() => edit(http, 'nao-e-uuid', validBody), invalidIdStatus, `${label} uuid`),
  );
  for (const role of forbiddenRoles) {
    if (!as[role]) continue;
    await logger.check(`${label} como ${role} responde 403`, () =>
      expectHttpError(() => edit(as[role], edit.sampleId, validBody), [403, 404], `${label} ${role}`),
    );
  }
  await logger.check(`${label} anônimo responde 401`, () =>
    expectHttpError(() => edit(as.anonymous, edit.sampleId, validBody), 401, `${label} anônimo`),
  );
}

module.exports = { MISSING_ID, expectFields, runEditContractChecks };
