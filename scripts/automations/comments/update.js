const { ensureRoleClients } = require('../common/role-users');
const { expectHttpError } = require('../common/errors');
const { expectFields, runEditContractChecks } = require('../common/update-helpers');

/** `PUT /comments/:id`, `publish`/`unpublish`: campos, parcial, validações e papéis. */
async function run({ http, logger, ctx }) {
  logger.section('comments/update');
  const as = await ensureRoleClients({ http, logger, ctx });
  const comment = (await http.request('post', '/comments', { data: { name: 'Autor Original', comment: 'Texto original', clubinho: 'Clubinho 1', neighborhood: 'Centro' } })).data;
  const id = comment.id;
  const edit = (client, targetId, body) => client.request('put', `/comments/${targetId}`, { data: body });
  edit.sampleId = id;

  await logger.check('PUT /comments/:id edita todos os campos e publica', async () => {
    const body = { name: 'Autor Editado', comment: 'Texto editado', clubinho: 'Clubinho 2', neighborhood: 'Vila Nova', published: true };
    const res = await edit(http, id, body);
    expectFields(res.data, body, 'PUT');
    const pub = (await as.anonymous.request('get', '/comments/published')).data;
    if (!pub.some((c) => c.id === id)) throw new Error('não apareceu em /comments/published');
    return 'ok';
  });
  await logger.check('PUT /comments/:id parcial (só comment) preserva o resto', async () => {
    const res = await edit(http, id, { comment: 'Só o texto' });
    expectFields(res.data, { comment: 'Só o texto', name: 'Autor Editado', published: true }, 'parcial');
    return 'ok';
  });
  await logger.check('PATCH unpublish tira da home e publish devolve', async () => {
    const un = (await http.request('patch', `/comments/${id}/unpublish`)).data;
    if (un.published !== false) throw new Error('unpublish');
    const pub = (await as.anonymous.request('get', '/comments/published')).data;
    if (pub.some((c) => c.id === id)) throw new Error('ainda na home');
    const re = (await http.request('patch', `/comments/${id}/publish`)).data;
    if (re.published !== true) throw new Error('publish');
    return 'ok';
  });
  await runEditContractChecks({ logger, as, http, label: 'PUT /comments/:id', edit, validBody: { comment: 'x' }, invalidBodies: [{ published: 'sim' }, { name: 'x'.repeat(1000) }, { foo: 1 }], forbiddenRoles: ['coordinator', 'teacher'] });
  await logger.check('PATCH /comments/:id/publish em id inexistente responde 404', () =>
    expectHttpError(() => http.request('patch', '/comments/00000000-0000-4000-8000-000000000000/publish'), 404, 'publish 404'),
  );
  if (as.teacher) {
    await logger.check('PATCH /comments/:id/unpublish como professor responde 403', () =>
      expectHttpError(() => as.teacher.request('patch', `/comments/${id}/unpublish`), 403, 'teacher'),
    );
  }
  await http.request('delete', `/comments/${id}`);
  return { ok: true };
}

module.exports = { run };
