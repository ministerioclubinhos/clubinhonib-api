const { ensureRoleClients } = require('../common/role-users');
const { expectHttpError } = require('../common/errors');

/** Banners informativos: só admin cria; corpo é `title`, `description`, `public`. */
async function run({ http, logger, ctx }) {
  logger.section('informatives/create');
  const as = await ensureRoleClients({ http, logger, ctx });
  const min = ctx?.minPagesItems ?? 5;
  ctx.createdInformatives = [];

  const existing = await http.request('get', '/informatives', { params: { page: 1, limit: 1 } });
  const toCreate = Math.max(2, min - (existing.data.total ?? 0));
  for (let i = 0; i < toCreate; i++) {
    await logger.check(`POST /informatives #${i + 1}`, async () => {
      const res = await http.request('post', '/informatives', {
        data: { title: `Aviso da automação #${i + 1}`, description: `Banner ${i % 2 === 0 ? 'público' : 'interno'} criado pelos scripts`, public: i % 2 === 0 },
      });
      ctx.createdInformatives.push(res.data);
      return `id=${res.data.id} public=${res.data.public}`;
    });
  }

  await logger.check('POST /informatives sem description responde 400/422', () =>
    expectHttpError(() => http.request('post', '/informatives', { data: { title: 'x', public: true } }), [400, 422], 'informative sem description'),
  );
  if (as.coordinator) {
    await logger.check('POST /informatives como coordenador responde 403', () =>
      expectHttpError(() => as.coordinator.request('post', '/informatives', { data: { title: 'x', description: 'y', public: true } }), 403, 'informative coord'),
    );
  }
  return { created: ctx.createdInformatives };
}

module.exports = { run };
