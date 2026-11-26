const { ensureRoleClients } = require('../common/role-users');
const { expectHttpError } = require('../common/errors');
const { expectFields, runEditContractChecks } = require('../common/update-helpers');

/** `PUT /site-feedbacks/:id` e read/unread: campos, parcial, validações e papéis. */
async function run({ http, logger, ctx }) {
  logger.section('site-feedbacks/update');
  const as = await ensureRoleClients({ http, logger, ctx });
  const feedback = (await (as.teacher ?? http).request('post', '/site-feedbacks', { data: { rating: 3, comment: 'Original', category: 'other' } })).data;
  const id = feedback.id;
  const edit = (client, targetId, body) => client.request('put', `/site-feedbacks/${targetId}`, { data: body });
  edit.sampleId = id;

  await logger.check('PUT /site-feedbacks/:id edita nota, comentário e categoria', async () => {
    const body = { rating: 5, comment: 'Editado pela automação', category: 'usability' };
    const res = await edit(http, id, body);
    expectFields(res.data, body, 'PUT');
    expectFields((await http.request('get', `/site-feedbacks/${id}`)).data, body, 'GET');
    return 'ok';
  });
  await logger.check('PUT /site-feedbacks/:id parcial (só rating) preserva o resto', async () => {
    const res = await edit(http, id, { rating: 1 });
    expectFields(res.data, { rating: 1, comment: 'Editado pela automação', category: 'usability' }, 'parcial');
    return 'ok';
  });
  await logger.check('PATCH read/unread alterna', async () => {
    const r = (await http.request('patch', `/site-feedbacks/${id}/read`)).data;
    const u = (await http.request('patch', `/site-feedbacks/${id}/unread`)).data;
    if (r.read !== true || u.read !== false) throw new Error('read/unread');
    return 'ok';
  });
  await runEditContractChecks({ logger, as, http, label: 'PUT /site-feedbacks/:id', edit, validBody: { rating: 4 }, invalidBodies: [{ rating: 0 }, { rating: 6 }, { category: 'xpto' }, { name: 'Impostor' }, { read: true }], forbiddenRoles: ['coordinator', 'teacher'] });
  await http.request('delete', `/site-feedbacks/${id}`);
  return { ok: true };
}

module.exports = { run };
