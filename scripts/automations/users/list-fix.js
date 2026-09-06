const { fetchAllPages } = require('../common/pagination');
const { multipartRequest } = require('../common/multipart');
const { fixture } = require('../common/fixtures');
const { expectHttpError } = require('../common/errors');
const { ensureRoleClients } = require('../common/role-users');
const { randomName, randomEmail, randomPhone } = require('../common/random');
const { DEFAULT_PASSWORD, EMAIL_DOMAIN } = require('../common/config');

/**
 * Listagem administrativa (`{ items, meta }`), filtros, detalhe, edição, foto
 * (multipart e link), remoção de descartável e regras de papel.
 * Fix: usuário da automação com `completed=false` volta a `completed=true`.
 */
async function run({ http, logger, ctx }) {
  logger.section('users/list-fix');
  const as = await ensureRoleClients({ http, logger, ctx });

  const all = await fetchAllPages(http.request, 'get', '/users', { sort: 'createdAt', order: 'DESC' }, { limit: 100 });
  logger.ok(`GET /users todas as páginas total=${all.length} (meta.total=${all.totalReported ?? 'n/a'}, páginas=${all.pagesRead})`);
  ctx.allUsers = all;

  for (const params of [{ role: 'teacher' }, { role: 'coordinator', active: true }, { q: EMAIL_DOMAIN }, { completed: true, sort: 'name', order: 'asc' }]) {
    await logger.check(`GET /users filtro ${JSON.stringify(params)}`, async () => {
      const res = await http.request('get', '/users', { params: { ...params, page: 1, limit: 10 } });
      const items = res.data?.items ?? [];
      if (params.role && items.some((u) => u.role !== params.role)) throw new Error('filtro role vazou outro papel');
      return `items=${items.length} total=${res.data?.meta?.total}`;
    });
  }

  await logger.check('GET /users com limit acima do teto responde 400/422', () =>
    expectHttpError(() => http.request('get', '/users', { params: { limit: 500 } }), [400, 422], 'users limit'),
  );

  const sample = ctx.roleUsers?.teacher ?? all[0];
  if (sample?.id) {
    await logger.check(`GET /users/${sample.id}`, async () => {
      const res = await http.request('get', `/users/${sample.id}`);
      if (res.data?.password || res.data?.refreshToken) throw new Error('detalhe expôs credenciais');
      return res.data.email;
    });
  }

  // Fix: reativa/completa os usuários da automação que ficaram pendentes.
  let fixed = 0;
  for (const u of all) {
    if (!u?.id || !u.email?.endsWith(`@${EMAIL_DOMAIN}`)) continue;
    if (u.completed === false) {
      try {
        await http.request('put', `/users/${u.id}`, { data: { completed: true } });
        fixed++;
      } catch (e) {
        logger.warn(`[users/list-fix] fix completed falhou ${u.id}: ${require('../common/errors').errorMessage(e)}`);
      }
    }
  }
  logger.ok(`[users/list-fix] fixCompleted=${fixed}`);

  // Ciclo de vida de um usuário descartável: cria, edita, foto, remove.
  await logger.check('ciclo POST→PUT→PATCH image→DELETE de usuário descartável', async () => {
    const created = await http.request('post', '/users', {
      data: { name: randomName(), email: randomEmail('descartavel'), password: DEFAULT_PASSWORD, phone: randomPhone(), role: 'teacher', active: true, completed: true },
    });
    const id = created.data.id;
    const updated = await http.request('put', `/users/${id}`, { data: { name: 'Nome Editado', commonUser: false, cpf: '12345678901' } });
    if (updated.data.name !== 'Nome Editado') throw new Error('PUT não aplicou name');

    const png = fixture('png', { seed: 7 });
    const withImage = await multipartRequest({
      http,
      method: 'PATCH',
      path: `/users/${id}/image`,
      fields: { imageData: JSON.stringify({ title: 'Foto', description: 'Automação', uploadType: 'upload', isLocalFile: true, fieldKey: 'file' }) },
      files: { file: png },
    });
    if (withImage.status !== 200) throw new Error(`PATCH image status=${withImage.status}`);

    const linkImage = await http.request('patch', `/users/${id}/image`, {
      data: { imageData: JSON.stringify({ title: 'Foto link', uploadType: 'link', url: 'https://picsum.photos/seed/clubinho/200', isLocalFile: false }) },
    });
    if (linkImage.status !== 200) throw new Error('PATCH image link falhou');

    await expectHttpError(
      () => multipartRequest({ http, method: 'PATCH', path: `/users/${id}/image`, fields: { imageData: JSON.stringify({ uploadType: 'upload', isLocalFile: true }) }, files: { file: fixture('pdf') } }),
      [400, 422],
      'imagem com PDF',
    );

    const removed = await http.request('delete', `/users/${id}`);
    await expectHttpError(() => http.request('get', `/users/${id}`), 404, 'usuário removido');
    return `id=${id} ${removed.data?.message ?? ''}`;
  });

  await logger.check('GET /users/:id com id inválido responde 400/422', () =>
    expectHttpError(() => http.request('get', '/users/nao-e-uuid'), [400, 422], 'uuid inválido'),
  );

  for (const key of ['teacher', 'coordinator']) {
    if (!as[key]) continue;
    await logger.check(`GET /users como ${key} responde 403`, () =>
      expectHttpError(() => as[key].request('get', '/users'), 403, `users ${key}`),
    );
  }
  await logger.check('GET /users anônimo responde 401', () =>
    expectHttpError(() => as.anonymous.request('get', '/users'), 401, 'users anônimo'),
  );

  return { users: all, fixed };
}

module.exports = { run };
