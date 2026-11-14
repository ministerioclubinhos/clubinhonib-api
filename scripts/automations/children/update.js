const { ensureRoleClients } = require('../common/role-users');
const { expectHttpError } = require('../common/errors');
const { expectFields, runEditContractChecks } = require('../common/update-helpers');
const { buildChild } = require('./create');

/** `PUT /children/:id`: todos os campos, parcial, limpezas com `null`, troca de clubinho, escopo e papéis. */
async function run({ http, logger, ctx }) {
  logger.section('children/update');
  const as = await ensureRoleClients({ http, logger, ctx });
  const clubs = ctx.clubs ?? (await http.request('get', '/clubs/all')).data;
  const [clubA, clubB] = clubs;
  const period = ctx.period ?? null;

  const child = (await http.request('post', '/children', { data: buildChild({ clubId: clubA?.id, period, withAddress: true }) })).data;
  const id = child.id;
  const edit = (client, targetId, body) => client.request('put', `/children/${targetId}`, { data: body });
  edit.sampleId = id;

  await logger.check('PUT /children/:id edita todos os campos', async () => {
    const body = { name: 'Criança Editada', birthDate: '2016-03-09', guardianName: 'Responsável Editado', gender: 'F', guardianPhone: '11955554444', joinedAt: period?.startDate ?? '2024-02-05', isActive: false, clubId: clubB?.id ?? clubA?.id, address: { street: 'Rua Nova', number: '5', district: 'Centro', city: 'Campinas', state: 'SP', postalCode: '13000000', complement: 'Casa' } };
    const res = await edit(http, id, body);
    expectFields(res.data, { name: body.name, birthDate: body.birthDate, guardianName: body.guardianName, gender: 'F', guardianPhone: body.guardianPhone, joinedAt: body.joinedAt, isActive: false }, 'PUT');
    if (res.data.club?.id !== body.clubId) throw new Error('clubinho não trocado');
    expectFields(res.data.address ?? {}, { street: 'Rua Nova', city: 'Campinas' }, 'address');
    const again = (await http.request('get', `/children/${id}`)).data;
    expectFields(again, { name: body.name, gender: 'F' }, 'GET');
    return `club #${again.club?.number}`;
  });
  await logger.check('PUT /children/:id parcial (só guardianPhone) preserva o resto', async () => {
    const res = await edit(http, id, { guardianPhone: '21933332222' });
    expectFields(res.data, { guardianPhone: '21933332222', name: 'Criança Editada', gender: 'F' }, 'parcial');
    return 'ok';
  });
  await logger.check('PUT /children/:id com joinedAt=null, clubId=null e guardianPhone vazio limpa os campos', async () => {
    const res = await edit(http, id, { joinedAt: null, clubId: null, guardianPhone: '' });
    if (res.data.joinedAt !== null) throw new Error(`joinedAt=${res.data.joinedAt}`);
    if (res.data.club !== null) throw new Error('clubinho não removido');
    return `guardianPhone="${res.data.guardianPhone}"`;
  });
  await logger.check('PUT /children/:id devolve a criança ao clubinho', async () => {
    const res = await edit(http, id, { clubId: clubA.id, joinedAt: period?.startDate ?? '2024-02-05', isActive: true });
    if (res.data.club?.id !== clubA.id) throw new Error('não voltou ao clubinho');
    return `#${res.data.club.number}`;
  });
  await logger.check('PATCH /children/:id/toggle-active alterna duas vezes', async () => {
    const a = (await http.request('patch', `/children/${id}/toggle-active`)).data;
    const b = (await http.request('patch', `/children/${id}/toggle-active`)).data;
    if (a.isActive === b.isActive) throw new Error('não alternou');
    return `${a.isActive} -> ${b.isActive}`;
  });
  await runEditContractChecks({
    logger, as, http, label: 'PUT /children/:id', edit,
    validBody: { name: 'Criança Editada' },
    invalidBodies: [{ gender: 'X' }, { name: 'A' }, { birthDate: 'ontem' }, { clubId: 'x' }, { isActive: 'sim' }, { address: { id: 'x' } }, { hacker: true }],
    forbiddenRoles: [],
  });
  await logger.check('PUT /children/:id com clubId inexistente responde 404', () =>
    expectHttpError(() => edit(http, id, { clubId: '00000000-0000-4000-8000-000000000000' }), [403, 404], 'club inexistente'),
  );

  if (as.teacher) {
    const me = (await as.teacher.request('get', '/auth/me')).data;
    const own = me.teacherProfile?.club?.id;
    const ownChild = (ctx.children ?? []).find((c) => c.club?.id === own) ?? (await as.teacher.request('get', '/children', { params: { page: 1, limit: 1 } })).data.data?.[0];
    if (ownChild) {
      await logger.check('PUT /children/:id do próprio clubinho como professor é permitido', async () => {
        const res = await as.teacher.request('put', `/children/${ownChild.id}`, { data: { guardianPhone: '11900001111' } });
        if (res.data.guardianPhone !== '11900001111') throw new Error('não aplicou');
        return 'ok';
      });
      await logger.check('PUT /children/:id movendo para clubinho alheio como professor responde 403/404', () =>
        expectHttpError(() => as.teacher.request('put', `/children/${ownChild.id}`, { data: { clubId: clubs.find((c) => c.id !== own)?.id } }), [403, 404], 'mover alheio'),
      );
    }
    if (child.club?.id !== own) {
      await logger.check('PUT /children/:id de outro clubinho como professor responde 403/404', () =>
        expectHttpError(() => as.teacher.request('put', `/children/${id}`, { data: { name: 'Invasor' } }), [403, 404], 'teacher alheio'),
      );
    }
  }

  await http.request('delete', `/children/${id}`);
  return { ok: true };
}

module.exports = { run };
