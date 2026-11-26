const { ensureRoleClients } = require('../common/role-users');
const { expectHttpError, errorStatus } = require('../common/errors');

const TEST_FLAG_KEY = 'automation_test_flag';

/**
 * Sincroniza o catálogo (`POST /feature-flags/seed`) e cria uma flag própria
 * da automação, que o `list-fix` edita, alterna e remove.
 */
async function run({ http, logger, ctx }) {
  logger.section('feature-flags/create');
  const as = await ensureRoleClients({ http, logger, ctx });

  await logger.check('POST /feature-flags/seed sincroniza o catálogo', async () => {
    const res = await http.request('post', '/feature-flags/seed');
    return `created=${res.data?.count} retired=${(res.data?.retired ?? []).length}`;
  });

  await logger.check(`POST /feature-flags cria ${TEST_FLAG_KEY} (idempotente)`, async () => {
    try {
      await http.request('get', `/feature-flags/${TEST_FLAG_KEY}`);
      return 'já existia';
    } catch (e) {
      if (errorStatus(e) !== 404) throw e;
    }
    const res = await http.request('post', '/feature-flags', {
      data: {
        key: TEST_FLAG_KEY,
        name: 'Flag da Automação',
        description: 'Criada pelos scripts de automação',
        enabled: true,
        targetRoles: ['admin', 'coordinator'],
        metadata: { origem: 'automation' },
      },
    });
    return `id=${res.data?.id} audience=${res.data?.audience}`;
  });

  await logger.check('POST /feature-flags com chave inválida (hífen) responde 400/422', () =>
    expectHttpError(() => http.request('post', '/feature-flags', { data: { key: 'flag-invalida', name: 'x' } }), [400, 422], 'flag key'),
  );

  await logger.check('POST /feature-flags com key repetida responde 409', () =>
    expectHttpError(() => http.request('post', '/feature-flags', { data: { key: TEST_FLAG_KEY, name: 'dup' } }), [409], 'flag dup'),
  );

  if (as.coordinator) {
    await logger.check('POST /feature-flags como coordenador responde 403', () =>
      expectHttpError(() => as.coordinator.request('post', '/feature-flags', { data: { key: 'outra_flag', name: 'x' } }), 403, 'flag coord'),
    );
  }

  ctx.testFlagKey = TEST_FLAG_KEY;
  return { key: TEST_FLAG_KEY };
}

module.exports = { run, TEST_FLAG_KEY };
