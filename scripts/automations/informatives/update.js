const { ensureRoleClients } = require('../common/role-users');
const { expectHttpError } = require('../common/errors');
const { expectFields, runEditContractChecks } = require('../common/update-helpers');

/** `PATCH /informatives/:id`: corpo completo obrigatório (title, description, public), validações e papéis. */
async function run({ http, logger, ctx }) {
  logger.section('informatives/update');
  const as = await ensureRoleClients({ http, logger, ctx });
  const informative = (await http.request('post', '/informatives', { data: { title: 'Original', description: 'Descrição original', public: false } })).data;
  const id = informative.id;
  const edit = (client, targetId, body) => client.request('patch', `/informatives/${targetId}`, { data: body });
  edit.sampleId = id;

  await logger.check('PATCH /informatives/:id edita título, descrição e publica', async () => {
    const body = { title: 'Editado', description: 'Descrição editada', public: true };
    const res = await edit(http, id, body);
    expectFields(res.data, body, 'PATCH');
    const list = (await http.request('get', '/informatives', { params: { public: true, searchString: 'Editado', page: 1, limit: 10 } })).data;
    if (!list.data.some((i) => i.id === id)) throw new Error('não apareceu no filtro public=true');
    return 'ok';
  });
  await logger.check('PATCH /informatives/:id despublica', async () => {
    const res = await edit(http, id, { title: 'Editado', description: 'Descrição editada', public: false });
    if (res.data.public !== false) throw new Error('public');
    return 'ok';
  });
  await logger.check('PATCH /informatives/:id sem description responde 400/422 (corpo completo é obrigatório)', () =>
    expectHttpError(() => edit(http, id, { title: 'Só título', public: true }), [400, 422], 'parcial recusado'),
  );
  await runEditContractChecks({ logger, as, http, label: 'PATCH /informatives/:id', edit, validBody: { title: 'x', description: 'y', public: true }, invalidBodies: [{ title: '', description: 'y', public: true }, { title: 'x', description: 'y', public: 'sim' }, { id, title: 'x', description: 'y', public: true }], forbiddenRoles: ['coordinator', 'teacher'] });
  await http.request('delete', `/informatives/${id}`);
  return { ok: true };
}

module.exports = { run };
