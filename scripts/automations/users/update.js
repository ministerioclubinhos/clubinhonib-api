const { randomName, randomEmail, randomPhone, randomCpf } = require('../common/random');
const { DEFAULT_PASSWORD } = require('../common/config');
const { ensureRoleClients } = require('../common/role-users');
const { loginAs } = require('../common/http');
const { expectHttpError } = require('../common/errors');
const { expectFields, runEditContractChecks } = require('../common/update-helpers');

/**
 * Edição de usuário (`PUT /users/:id`): todos os campos, parcial, troca de
 * senha pelo admin (sem senha atual), conflito de e-mail, validações, 404,
 * uuid inválido e papéis. A entidade editada é criada aqui e removida no fim.
 */
async function run({ http, logger, ctx }) {
  logger.section('users/update');
  const as = await ensureRoleClients({ http, logger, ctx });

  const created = (await http.request('post', '/users', {
    data: { name: randomName(), email: randomEmail('edit'), password: DEFAULT_PASSWORD, phone: randomPhone(), role: 'teacher', active: true, completed: true, commonUser: true },
  })).data;
  const id = created.id;
  const edit = (client, targetId, body) => client.request('put', `/users/${targetId}`, { data: body });
  edit.sampleId = id;

  await logger.check('PUT /users/:id edita todos os campos de uma vez', async () => {
    const newEmail = randomEmail('edited');
    const body = { name: 'Nome Editado Completo', email: newEmail, phone: '11988887777', role: 'coordinator', active: false, completed: false, commonUser: false, cpf: randomCpf() };
    const res = await edit(http, id, body);
    expectFields(res.data, body, 'PUT');
    const again = (await http.request('get', `/users/${id}`)).data;
    expectFields(again, body, 'GET após PUT');
    return `role=${again.role} active=${again.active}`;
  });

  await logger.check('PUT /users/:id parcial só toca o campo enviado', async () => {
    const before = (await http.request('get', `/users/${id}`)).data;
    const res = await edit(http, id, { phone: '21999990000' });
    expectFields(res.data, { phone: '21999990000', name: before.name, email: before.email, role: before.role, active: before.active }, 'parcial');
    return 'phone alterado, resto intacto';
  });

  await logger.check('PUT /users/:id troca a senha sem senha atual e o login passa a usar a nova', async () => {
    await edit(http, id, { password: 'SenhaNova123@', active: true, completed: true, role: 'teacher' });
    const session = await loginAs({ email: (await http.request('get', `/users/${id}`)).data.email, password: 'SenhaNova123@', label: 'edited' });
    return `login ok userId=${session.getUser()?.id}`;
  });

  await logger.check('PUT /users/:id com e-mail de outro usuário responde 409', () =>
    expectHttpError(() => edit(http, id, { email: ctx.roleCredentials?.teacher?.email ?? 'superuser@clubinhonib.com' }), 409, 'email dup'),
  );

  await runEditContractChecks({
    logger, as, http, label: 'PUT /users/:id', edit,
    validBody: { name: 'X' },
    invalidBodies: [{ role: 'hacker' }, { email: 'nao-e-email' }, { password: '123' }, { active: 'sim' }, { desconhecido: 1 }],
    forbiddenRoles: ['coordinator', 'teacher'],
  });

  await logger.check('PATCH /users/:id/image com JSON de link edita a foto', async () => {
    const res = await http.request('patch', `/users/${id}/image`, { data: { imageData: JSON.stringify({ title: 'Foto', uploadType: 'link', url: 'https://picsum.photos/seed/edit/200', isLocalFile: false }) } });
    if (res.status !== 200) throw new Error(`status=${res.status}`);
    return 'ok';
  });

  await http.request('delete', `/users/${id}`);
  return { ok: true };
}

module.exports = { run };
