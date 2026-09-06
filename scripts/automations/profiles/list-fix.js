const { fetchAllPages } = require('../common/pagination');
const { ensureRoleClients } = require('../common/role-users');
const { expectHttpError } = require('../common/errors');
const { loginAs } = require('../common/http');
const { randomName, randomEmail, randomPhone } = require('../common/random');
const { DEFAULT_PASSWORD } = require('../common/config');
const { buildProfilePayload } = require('./create');

/**
 * Listagem paginada (admin e coordenador), filtros, aniversariantes, `me`,
 * detalhe/edição/remoção por id (só admin) e as recusas por papel.
 * Fix: perfil da automação sem `favoriteColor` recebe uma cor.
 */
async function run({ http, logger, ctx }) {
  logger.section('profiles/list-fix');
  const as = await ensureRoleClients({ http, logger, ctx });

  const all = await fetchAllPages(http.request, 'get', '/profiles', { sortBy: 'name', order: 'ASC' }, { limit: 100 });
  logger.ok(`GET /profiles todas as páginas total=${all.length} (páginas=${all.pagesRead})`);

  for (const params of [{ role: 'teacher' }, { q: 'automação' }, { favoriteColor: 'Azul' }, { sortBy: 'birthDate', order: 'DESC' }]) {
    await logger.check(`GET /profiles filtro ${JSON.stringify(params)}`, async () => {
      const res = await http.request('get', '/profiles', { params: { ...params, page: 1, limit: 12 } });
      return `items=${(res.data?.data ?? res.data?.items ?? []).length}`;
    });
  }

  if (as.coordinator) {
    await logger.check('GET /profiles como coordenador é permitido', async () => {
      const res = await as.coordinator.request('get', '/profiles', { params: { page: 1, limit: 5 } });
      return `items=${(res.data?.data ?? res.data?.items ?? []).length}`;
    });
  }
  if (as.teacher) {
    await logger.check('GET /profiles como professor responde 403', () =>
      expectHttpError(() => as.teacher.request('get', '/profiles'), 403, 'profiles teacher'),
    );
    await logger.check('GET /profiles/me como professor', async () => {
      const res = await as.teacher.request('get', '/profiles/me');
      return `email=${res.data?.email}`;
    });
    await logger.check('PUT /profiles/me como professor', async () => {
      const res = await as.teacher.request('put', '/profiles/me', { data: { preferences: { favoriteFood: 'Lasanha' } } });
      if (res.data?.preferences?.favoriteFood !== 'Lasanha') throw new Error('preferência não aplicada');
      return 'favoriteFood=Lasanha';
    });
  }

  await logger.check('GET /profiles/birthdays', async () => {
    const res = await http.request('get', '/profiles/birthdays');
    if (!Array.isArray(res.data)) throw new Error('esperava array');
    return `aniversariantes=${res.data.length}`;
  });

  // Fix: perfis sem cor preferida ganham uma.
  let fixed = 0;
  for (const p of all) {
    if (!p?.id) continue;
    if (p.preferences && !p.preferences.favoriteColor) {
      try {
        await http.request('put', `/profiles/${p.id}`, { data: { preferences: { favoriteColor: 'Verde' } } });
        fixed++;
      } catch (e) {
        logger.warn(`[profiles/list-fix] fix favoriteColor falhou ${p.id}: ${require('../common/errors').errorMessage(e)}`);
      }
    }
  }
  logger.ok(`[profiles/list-fix] fixFavoriteColor=${fixed}`);

  const target = ctx.roleUsers?.teacher?.id;
  if (target) {
    await logger.check('GET/PUT /profiles/:id como admin', async () => {
      const res = await http.request('get', `/profiles/${target}`);
      const upd = await http.request('put', `/profiles/${target}`, { data: { personalData: { gaLeaderName: 'Líder Atualizado' } } });
      if (upd.data?.personalData?.gaLeaderName !== 'Líder Atualizado') throw new Error('PUT não aplicou');
      return `email=${res.data?.email}`;
    });
    if (as.coordinator) {
      await logger.check('PUT /profiles/:id como coordenador responde 403', () =>
        expectHttpError(() => as.coordinator.request('put', `/profiles/${target}`, { data: { preferences: { favoriteColor: 'Preto' } } }), 403, 'profiles coord put'),
      );
    }
  }

  await logger.check('DELETE /profiles/:id remove o perfil de um usuário descartável', async () => {
    const created = await http.request('post', '/users', {
      data: { name: randomName(), email: randomEmail('perfil.descartavel'), password: DEFAULT_PASSWORD, phone: randomPhone(), role: 'teacher', active: true, completed: true, commonUser: true },
    });
    const session = await loginAs({ email: created.data.email, password: DEFAULT_PASSWORD, label: 'disposable' });
    await session.request('post', '/profiles', { data: buildProfilePayload(9) });
    const del = await http.request('delete', `/profiles/${created.data.id}`);
    await http.request('delete', `/users/${created.data.id}`);
    return del.data?.message;
  });

  await logger.check('GET /profiles/:id com uuid inválido responde 400/422', () =>
    expectHttpError(() => http.request('get', '/profiles/abc'), [400, 422], 'profiles uuid'),
  );

  return { profiles: all, fixed };
}

module.exports = { run };
