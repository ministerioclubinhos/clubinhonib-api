const { ensureRoleClients } = require('../common/role-users');
const { expectHttpError, errorStatus } = require('../common/errors');
const { expectFields } = require('../common/update-helpers');

const KEY = 'automation_edit_flag';
const OTHER_KEY = 'automation_edit_flag_b';

/** `PATCH /feature-flags/:key` e `/toggle`: cada campo, renomeação da chave, conflito, validações e papéis. */
async function run({ http, logger, ctx }) {
  logger.section('feature-flags/update');
  const as = await ensureRoleClients({ http, logger, ctx });

  const ensureFlag = async (key) => {
    try {
      return (await http.request('get', `/feature-flags/${key}`)).data;
    } catch (e) {
      if (errorStatus(e) !== 404) throw e;
      return (await http.request('post', '/feature-flags', { data: { key, name: `Flag ${key}`, enabled: false, targetRoles: ['teacher'] } })).data;
    }
  };
  await ensureFlag(KEY);
  await ensureFlag(OTHER_KEY);

  await logger.check(`PATCH /feature-flags/${KEY} edita nome, descrição, público e metadata`, async () => {
    const body = { name: 'Flag Editada', description: 'Descrição editada', enabled: true, targetRoles: ['admin', 'coordinator'], metadata: { origem: 'update.js', versao: 2 } };
    const res = await http.request('patch', `/feature-flags/${KEY}`, { data: body });
    expectFields(res.data, { name: body.name, description: body.description, enabled: true, audience: 'ADMIN_COORDINATOR', metadata: body.metadata }, 'PATCH');
    const map = (await as.teacher.request('get', '/feature-flags/map')).data;
    if (map[KEY] === true) throw new Error('professor não deveria enxergar a flag ligada');
    return `audience=${res.data.audience}`;
  });

  await logger.check(`PATCH /feature-flags/${KEY} parcial (só description) preserva o resto`, async () => {
    const res = await http.request('patch', `/feature-flags/${KEY}`, { data: { description: 'Só a descrição' } });
    expectFields(res.data, { description: 'Só a descrição', name: 'Flag Editada', enabled: true }, 'parcial');
    return 'ok';
  });

  await logger.check(`PATCH /feature-flags/${KEY} com targetRoles vazio abre para todos (EVERYONE)`, async () => {
    const res = await http.request('patch', `/feature-flags/${KEY}`, { data: { targetRoles: [] } });
    if (res.data.audience !== 'EVERYONE') throw new Error(`audience=${res.data.audience}`);
    const anon = (await as.anonymous.request('get', '/feature-flags/map')).data;
    if (anon[KEY] !== true) throw new Error('anônimo deveria enxergar a flag');
    return 'EVERYONE';
  });

  await logger.check(`PATCH /feature-flags/${KEY}/toggle inverte e volta`, async () => {
    const a = (await http.request('patch', `/feature-flags/${KEY}/toggle`)).data;
    const b = (await http.request('patch', `/feature-flags/${KEY}/toggle`)).data;
    if (a.enabled === b.enabled) throw new Error('toggle não inverteu');
    return `${a.enabled} -> ${b.enabled}`;
  });

  await logger.check('PATCH renomeia a chave e a antiga deixa de existir', async () => {
    const renamed = `${KEY}_renomeada`;
    const res = await http.request('patch', `/feature-flags/${KEY}`, { data: { key: renamed } });
    if (res.data.key !== renamed) throw new Error('key não mudou');
    await expectHttpError(() => http.request('get', `/feature-flags/${KEY}`), 404, 'chave antiga');
    await http.request('patch', `/feature-flags/${renamed}`, { data: { key: KEY } });
    return renamed;
  });

  await logger.check(`PATCH /feature-flags/${KEY} renomeando para chave já existente responde 409`, () =>
    expectHttpError(() => http.request('patch', `/feature-flags/${KEY}`, { data: { key: OTHER_KEY } }), 409, 'key conflito'),
  );
  await logger.check('PATCH com targetRoles inválido responde 400/422', () =>
    expectHttpError(() => http.request('patch', `/feature-flags/${KEY}`, { data: { targetRoles: ['visitante'] } }), [400, 422], 'roles'),
  );
  await logger.check('PATCH com chave com hífen responde 400/422', () =>
    expectHttpError(() => http.request('patch', `/feature-flags/${KEY}`, { data: { key: 'com-hifen' } }), [400, 422], 'key'),
  );
  await logger.check('PATCH em chave inexistente responde 404', () =>
    expectHttpError(() => http.request('patch', '/feature-flags/nao_existe_xyz', { data: { name: 'x' } }), 404, '404'),
  );
  for (const role of ['coordinator', 'teacher']) {
    if (!as[role]) continue;
    await logger.check(`PATCH /feature-flags/:key como ${role} responde 403`, () =>
      expectHttpError(() => as[role].request('patch', `/feature-flags/${KEY}`, { data: { name: 'x' } }), 403, role),
    );
    await logger.check(`PATCH /feature-flags/:key/toggle como ${role} responde 403`, () =>
      expectHttpError(() => as[role].request('patch', `/feature-flags/${KEY}/toggle`), 403, role),
    );
  }
  await logger.check('PATCH /feature-flags/:key anônimo responde 401', () =>
    expectHttpError(() => as.anonymous.request('patch', `/feature-flags/${KEY}`, { data: { name: 'x' } }), 401, 'anônimo'),
  );

  await http.request('delete', `/feature-flags/${KEY}`);
  await http.request('delete', `/feature-flags/${OTHER_KEY}`);
  return { ok: true };
}

module.exports = { run };
