const { randomName, pick } = require('../common/random');
const { ensureRoleClients } = require('../common/role-users');
const { expectHttpError } = require('../common/errors');

const TEXTS = [
  'O clubinho mudou a semana das crianças do nosso bairro.',
  'Meu filho não perde um encontro. Gratidão à equipe!',
  'Excelente iniciativa, os professores são muito dedicados.',
  'As crianças aprendem brincando e voltam felizes.',
];

/** Qualquer papel autenticado envia um comentário; ele nasce despublicado. */
async function run({ http, logger, ctx }) {
  logger.section('comments/create');
  const as = await ensureRoleClients({ http, logger, ctx });
  const min = ctx?.minPagesItems ?? 5;

  const clubs = ctx.clubs ?? [];
  ctx.createdComments = [];
  for (const [key, client] of Object.entries({ admin: as.admin ?? http, coordinator: as.coordinator, teacher: as.teacher })) {
    if (!client) continue;
    await logger.check(`POST /comments como ${key}`, async () => {
      const club = pick(clubs.length ? clubs : [{ number: 1, address: null }]);
      const res = await client.request('post', '/comments', {
        data: { name: randomName(), comment: pick(TEXTS), clubinho: `Clubinho ${club.number}`, neighborhood: club.address?.district ?? 'Centro' },
      });
      if (res.data.published !== false) throw new Error('comentário novo deveria nascer despublicado');
      ctx.createdComments.push(res.data);
      return `id=${res.data.id}`;
    });
  }

  const existing = await http.request('get', '/comments', { params: { page: 1, limit: 1 } });
  const missing = Math.max(0, min - (existing.data.total ?? 0));
  for (let i = 0; i < missing; i++) {
    const club = pick(clubs.length ? clubs : [{ number: 1, address: null }]);
    const res = await http.request('post', '/comments', {
      data: { name: randomName(), comment: pick(TEXTS), clubinho: `Clubinho ${club.number}`, neighborhood: club.address?.district ?? 'Centro' },
    });
    ctx.createdComments.push(res.data);
  }
  logger.ok(`[comments/create] criados para completar mínimo=${missing}`);

  await logger.check('POST /comments sem bairro responde 400/422', () =>
    expectHttpError(() => http.request('post', '/comments', { data: { name: 'X', comment: 'y', clubinho: 'z' } }), [400, 422], 'comment sem bairro'),
  );
  await logger.check('POST /comments com published no corpo responde 400/422 (whitelist)', () =>
    expectHttpError(() => http.request('post', '/comments', { data: { name: 'X', comment: 'y', clubinho: 'z', neighborhood: 'w', published: true } }), [400, 422], 'comment whitelist'),
  );
  await logger.check('POST /comments anônimo responde 401', () =>
    expectHttpError(() => as.anonymous.request('post', '/comments', { data: { name: 'X', comment: 'y', clubinho: 'z', neighborhood: 'w' } }), 401, 'comment anônimo'),
  );

  return { created: ctx.createdComments };
}

module.exports = { run };
