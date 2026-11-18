const { ensureRoleClients } = require('../common/role-users');
const { expectHttpError } = require('../common/errors');
const { randomName, randomEmail, randomPhone } = require('../common/random');

/** A única edição de contato é lido/não lido: `PATCH /contact/:id/read|unread`. */
async function run({ http, logger, ctx }) {
  logger.section('contact/update');
  const as = await ensureRoleClients({ http, logger, ctx });
  let contact = (ctx.createdContacts ?? []).find((c) => c?.id);
  if (!contact) {
    try {
      contact = (await as.anonymous.request('post', '/contact', { data: { name: randomName(), email: randomEmail('contato'), phone: randomPhone(), message: 'Mensagem longa o suficiente para a automação de edição.' } })).data;
    } catch {
      contact = (await http.request('get', '/contact', { params: { page: 1, limit: 1 } })).data.data?.[0];
    }
  }
  if (!contact) {
    logger.warn('[contact/update] sem contato para editar');
    return { ok: false };
  }
  await logger.check('PATCH read/unread alterna e o unread-count acompanha', async () => {
    const before = (await http.request('get', '/contact/unread-count')).data.unread;
    const unread = (await http.request('patch', `/contact/${contact.id}/unread`)).data;
    if (unread.read !== false) throw new Error('unread não aplicou');
    const mid = (await http.request('get', '/contact/unread-count')).data.unread;
    const read = (await http.request('patch', `/contact/${contact.id}/read`)).data;
    if (read.read !== true) throw new Error('read não aplicou');
    const after = (await http.request('get', '/contact/unread-count')).data.unread;
    if (mid < after) throw new Error(`unread-count não refletiu (${before}->${mid}->${after})`);
    return `unread ${before}->${mid}->${after}`;
  });
  await logger.check('PATCH read repetido é idempotente', async () => {
    const res = await http.request('patch', `/contact/${contact.id}/read`);
    if (res.data.read !== true) throw new Error('idempotência');
    return 'ok';
  });
  await logger.check('PATCH /contact/:id/read em id inexistente responde 404', () =>
    expectHttpError(() => http.request('patch', '/contact/00000000-0000-4000-8000-000000000000/read'), 404, '404'),
  );
  await logger.check('PATCH /contact/:id/read com uuid inválido responde 400/422', () =>
    expectHttpError(() => http.request('patch', '/contact/x/read'), [400, 422], 'uuid'),
  );
  for (const role of ['coordinator', 'teacher']) {
    if (!as[role]) continue;
    await logger.check(`PATCH /contact/:id/read como ${role} responde 403`, () =>
      expectHttpError(() => as[role].request('patch', `/contact/${contact.id}/read`), 403, role),
    );
  }
  await logger.check('PATCH /contact/:id/read anônimo responde 401', () =>
    expectHttpError(() => as.anonymous.request('patch', `/contact/${contact.id}/read`), 401, 'anônimo'),
  );
  return { ok: true };
}

module.exports = { run };
