const { randomClubNumber, randomAddress } = require('../common/random');
const { ensureRoleClients } = require('../common/role-users');
const { expectHttpError } = require('../common/errors');
const { expectFields, runEditContractChecks } = require('../common/update-helpers');
const { createUserWithProfile } = require('./list-fix');

/** `PATCH /clubs/:id`: todos os campos, `time`/`coordinatorProfileId` nulos, endereço, professores, toggle e papéis. */
async function run({ http, logger, ctx }) {
  logger.section('clubs/update');
  const as = await ensureRoleClients({ http, logger, ctx });

  const club = (await http.request('post', '/clubs', { data: { number: randomClubNumber(), weekday: 'monday', time: '14:00', address: randomAddress() } })).data;
  const id = club.id;
  const edit = (client, targetId, body) => client.request('patch', `/clubs/${targetId}`, { data: body });
  edit.sampleId = id;

  const { profile: coordinator } = await createUserWithProfile({ http, role: 'coordinator' });
  const { profile: teacherA } = await createUserWithProfile({ http, role: 'teacher' });
  const { profile: teacherB } = await createUserWithProfile({ http, role: 'teacher' });

  await logger.check('PATCH /clubs/:id edita número, dia, horário, status, endereço, coordenador e professores', async () => {
    const body = { number: randomClubNumber(), weekday: 'saturday', time: '9:15', isActive: false, address: { street: 'Rua Editada', number: '10', district: 'Bairro Editado', city: 'Sorocaba', state: 'SP', postalCode: '18000000', complement: 'Sala 2' }, coordinatorProfileId: coordinator.id, teacherProfileIds: [teacherA.id, teacherB.id] };
    const res = await edit(http, id, body);
    expectFields(res.data, { number: body.number, weekday: 'saturday', time: '09:15', isActive: false }, 'PATCH');
    expectFields(res.data.address ?? {}, body.address, 'address');
    if (res.data.coordinator?.id !== coordinator.id) throw new Error('coordenador não aplicado');
    const ids = (res.data.teachers ?? []).map((t) => t.id).sort();
    if (JSON.stringify(ids) !== JSON.stringify([teacherA.id, teacherB.id].sort())) throw new Error(`professores=${ids}`);
    const again = (await http.request('get', `/clubs/${id}`)).data;
    expectFields(again, { number: body.number, time: '09:15' }, 'GET');
    return `#${again.number} teachers=${again.teachers.length}`;
  });

  await logger.check('PATCH /clubs/:id parcial (só weekday) preserva o resto', async () => {
    const res = await edit(http, id, { weekday: 'friday' });
    expectFields(res.data, { weekday: 'friday', time: '09:15', isActive: false }, 'parcial');
    if (res.data.coordinator?.id !== coordinator.id || res.data.teachers.length !== 2) throw new Error('vínculos perdidos na edição parcial');
    return 'ok';
  });

  await logger.check('PATCH /clubs/:id com time=null limpa o horário e coordinatorProfileId=null desvincula', async () => {
    const res = await edit(http, id, { time: null, coordinatorProfileId: null });
    if (res.data.time !== null) throw new Error(`time=${res.data.time}`);
    if (res.data.coordinator !== null) throw new Error('coordenador ainda vinculado');
    return 'ok';
  });

  await logger.check('PATCH /clubs/:id com teacherProfileIds=[] desvincula todos e reatribui um', async () => {
    const empty = await edit(http, id, { teacherProfileIds: [] });
    if (empty.data.teachers.length !== 0) throw new Error('professores não desvinculados');
    const one = await edit(http, id, { teacherProfileIds: [teacherA.id] });
    if (one.data.teachers.length !== 1 || one.data.teachers[0].id !== teacherA.id) throw new Error('reatribuição falhou');
    return 'ok';
  });

  await logger.check('PATCH /clubs/:id/toggle-active alterna e reflete na listagem por isActive', async () => {
    const on = (await http.request('patch', `/clubs/${id}/toggle-active`)).data;
    const list = (await http.request('get', '/clubs', { params: { isActive: on.isActive, searchString: String(on.number), page: 1, limit: 50 } })).data;
    if (!list.data.some((c) => c.id === id)) throw new Error('clubinho não apareceu no filtro isActive');
    return `isActive=${on.isActive}`;
  });

  await runEditContractChecks({
    logger, as, http, label: 'PATCH /clubs/:id', edit,
    validBody: { time: '10:00' },
    invalidBodies: [{ weekday: 'domingo' }, { time: '25:00' }, { number: 0 }, { teacherProfileIds: ['x'] }, { coordinatorProfileId: 'nao-uuid' }, { isActive: 'sim' }, { foo: 1 }],
    forbiddenRoles: ['teacher'],
  });

  if (as.coordinator) {
    await logger.check('PATCH /clubs/:id de outra coordenação como coordenador responde 403/404', () =>
      expectHttpError(() => edit(as.coordinator, id, { time: '10:00' }), [403, 404], 'coord alheio'),
    );
    const own = (await as.coordinator.request('get', '/clubs', { params: { page: 1, limit: 1 } })).data.data?.[0];
    if (own) {
      await logger.check('PATCH /clubs/:id do próprio clubinho como coordenador é permitido', async () => {
        const res = await as.coordinator.request('patch', `/clubs/${own.id}`, { data: { time: '16:45' } });
        if (res.data.time !== '16:45') throw new Error('time não aplicado');
        return `#${own.number}`;
      });
    }
  }

  await http.request('delete', `/clubs/${id}`);
  return { ok: true };
}

module.exports = { run };
