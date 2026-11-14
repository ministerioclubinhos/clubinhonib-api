const { fetchAllPages } = require('../common/pagination');
const { ensureRoleClients } = require('../common/role-users');
const { expectHttpError } = require('../common/errors');
const { TEST_FLAG_KEY } = require('./create');

/**
 * Listagem paginada com filtros, stats, mapa por papel (público), check de
 * uma chave, edição, toggle e remoção da flag da automação.
 * Fix: flag do catálogo desligada por engano fica ligada de novo? Não — o
 * estado das flags é decisão do produto; aqui só se garante que nenhuma flag
 * do catálogo ficou sem `name`.
 */
async function run({ http, logger, ctx }) {
  logger.section('feature-flags/list-fix');
  const as = await ensureRoleClients({ http, logger, ctx });

  const all = await fetchAllPages(http.request, 'get', '/feature-flags', { sort: 'key', order: 'ASC' }, { limit: 50 });
  logger.ok(`GET /feature-flags todas as páginas total=${all.length}`);
  const semNome = all.filter((f) => !f.name);
  if (semNome.length) logger.warn(`[feature-flags/list-fix] flags sem nome: ${semNome.map((f) => f.key).join(', ')}`);

  for (const params of [{ enabled: true }, { audience: 'ADMIN' }, { searchString: 'clubinho' }]) {
    await logger.check(`GET /feature-flags filtro ${JSON.stringify(params)}`, async () => {
      const res = await http.request('get', '/feature-flags', { params: { ...params, page: 1, limit: 20 } });
      return `data=${(res.data?.data ?? []).length} total=${res.data?.total}`;
    });
  }

  await logger.check('GET /feature-flags/stats', async () => {
    const res = await http.request('get', '/feature-flags/stats');
    return `total=${res.data?.total} enabled=${res.data?.enabled} disabled=${res.data?.disabled}`;
  });

  await logger.check('GET /feature-flags/map anônimo e por papel', async () => {
    const anon = await as.anonymous.request('get', '/feature-flags/map');
    const admin = await http.request('get', '/feature-flags/map');
    if (typeof anon.data !== 'object') throw new Error('map anônimo não é objeto');
    if (anon.data[TEST_FLAG_KEY] === true) throw new Error('flag restrita a admin/coordenador apareceu ligada para anônimo');
    if (admin.data[TEST_FLAG_KEY] !== true) throw new Error('flag deveria estar ligada para admin');
    if (as.teacher) {
      const teacher = await as.teacher.request('get', '/feature-flags/map');
      if (teacher.data[TEST_FLAG_KEY] === true) throw new Error('flag não deveria valer para professor');
    }
    return `chaves=${Object.keys(admin.data).length}`;
  });

  await logger.check(`GET /feature-flags/check/${TEST_FLAG_KEY}`, async () => {
    const res = await http.request('get', `/feature-flags/check/${TEST_FLAG_KEY}`);
    if (res.data?.enabled !== true) throw new Error('check deveria ser true para admin');
    return 'enabled=true';
  });

  await logger.check(`PATCH /feature-flags/${TEST_FLAG_KEY} e toggle`, async () => {
    const upd = await http.request('patch', `/feature-flags/${TEST_FLAG_KEY}`, { data: { description: 'Editada pela automação', targetRoles: [] } });
    if (upd.data?.description !== 'Editada pela automação') throw new Error('PATCH não aplicou');
    const before = upd.data.enabled;
    const toggled = await http.request('patch', `/feature-flags/${TEST_FLAG_KEY}/toggle`);
    if (toggled.data.enabled === before) throw new Error('toggle não inverteu');
    await http.request('patch', `/feature-flags/${TEST_FLAG_KEY}/toggle`);
    return `audience=${upd.data.audience}`;
  });

  await logger.check(`GET /feature-flags/${TEST_FLAG_KEY} como coordenador responde 403`, async () => {
    if (!as.coordinator) return 'sem coordenador';
    return expectHttpError(() => as.coordinator.request('get', `/feature-flags/${TEST_FLAG_KEY}`), 403, 'flag coord');
  });

  await logger.check(`DELETE /feature-flags/${TEST_FLAG_KEY} responde 204`, async () => {
    const res = await http.request('delete', `/feature-flags/${TEST_FLAG_KEY}`);
    if (res.status !== 204) throw new Error(`status=${res.status}`);
    await expectHttpError(() => http.request('get', `/feature-flags/${TEST_FLAG_KEY}`), 404, 'flag removida');
    return 'removida';
  });

  await logger.check('GET /feature-flags/:key inexistente responde 404', () =>
    expectHttpError(() => http.request('get', '/feature-flags/nao_existe_xyz'), 404, 'flag 404'),
  );

  return { flags: all };
}

module.exports = { run };
