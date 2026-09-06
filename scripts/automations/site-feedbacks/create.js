const { ensureRoleClients } = require('../common/role-users');
const { expectHttpError } = require('../common/errors');
const { pick } = require('../common/random');

const CATEGORIES = ['content', 'appearance', 'usability', 'broken_feature', 'missing_feature', 'performance', 'mobile_experience', 'suggestion', 'complaint', 'other'];

/** Avaliação do site: o autor vem do token; só `rating`, `comment` e `category` entram no corpo. */
async function run({ http, logger, ctx }) {
  logger.section('site-feedbacks/create');
  const as = await ensureRoleClients({ http, logger, ctx });
  const min = ctx?.minPagesItems ?? 5;
  ctx.createdFeedbacks = [];

  const clients = Object.entries({ superuser: http, admin: as.admin, coordinator: as.coordinator, teacher: as.teacher, googleLike: as.googleLike }).filter(([, c]) => c);
  const existing = await http.request('get', '/site-feedbacks', { params: { page: 1, limit: 1 } });
  const toCreate = Math.max(clients.length, min - (existing.data.total ?? 0));
  for (let i = 0; i < toCreate; i++) {
    const [key, client] = clients[i % clients.length];
    await logger.check(`POST /site-feedbacks como ${key}`, async () => {
      const category = CATEGORIES[i % CATEGORIES.length];
      const res = await client.request('post', '/site-feedbacks', { data: { rating: 1 + (i % 5), comment: `Feedback ${category} enviado pela automação`, category } });
      if (!res.data?.name || !res.data?.email) throw new Error('resposta sem name/email do autor');
      if (res.data.read !== false) throw new Error('feedback novo deveria nascer não lido');
      ctx.createdFeedbacks.push(res.data);
      return `id=${res.data.id} rating=${res.data.rating}`;
    });
  }

  await logger.check('POST /site-feedbacks com rating 6 responde 400/422', () =>
    expectHttpError(() => http.request('post', '/site-feedbacks', { data: { rating: 6, comment: 'x', category: 'other' } }), [400, 422], 'feedback rating'),
  );
  await logger.check('POST /site-feedbacks com name no corpo responde 400/422 (whitelist)', () =>
    expectHttpError(() => http.request('post', '/site-feedbacks', { data: { rating: 5, comment: 'x', category: 'other', name: 'Impostor' } }), [400, 422], 'feedback whitelist'),
  );
  await logger.check('POST /site-feedbacks com categoria inválida responde 400/422', () =>
    expectHttpError(() => http.request('post', '/site-feedbacks', { data: { rating: 5, comment: 'x', category: pick(['xpto', 'design']) } }), [400, 422], 'feedback category'),
  );
  await logger.check('POST /site-feedbacks anônimo responde 401', () =>
    expectHttpError(() => as.anonymous.request('post', '/site-feedbacks', { data: { rating: 5, comment: 'x', category: 'other' } }), 401, 'feedback anônimo'),
  );

  return { created: ctx.createdFeedbacks };
}

module.exports = { run };
