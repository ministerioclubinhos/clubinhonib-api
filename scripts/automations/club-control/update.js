const { ACADEMIC_YEAR } = require('../common/config');
const { ensureRoleClients } = require('../common/role-users');
const { expectHttpError, errorStatus } = require('../common/errors');
const { expectFields, runEditContractChecks } = require('../common/update-helpers');
const { ensureAcademicPeriod } = require('./create');

/** `PUT /club-control/periods/:id` e `PATCH /club-control/exceptions/:id`: campos, parciais, validações e papéis. */
async function run({ http, logger, ctx }) {
  logger.section('club-control/update');
  const as = await ensureRoleClients({ http, logger, ctx });
  const year = ctx?.year ?? ACADEMIC_YEAR;
  const period = ctx.period ?? (await ensureAcademicPeriod({ http, year }));

  // Um período descartável em ano distante, para editar datas sem mexer no ano corrente.
  const scratchYear = 2097;
  let scratch;
  try {
    scratch = (await http.request('get', `/club-control/periods/${scratchYear}`)).data;
    if (!scratch?.id) throw Object.assign(new Error('vazio'), { response: { status: 404 } });
  } catch (e) {
    if (errorStatus(e) !== 404) throw e;
    scratch = (await http.request('post', '/club-control/periods', { data: { year: scratchYear, startDate: `${scratchYear}-02-01`, endDate: `${scratchYear}-12-10`, description: 'Descartável' } })).data;
  }
  const editPeriod = (client, id, body) => client.request('put', `/club-control/periods/${id}`, { data: body });
  editPeriod.sampleId = scratch.id;

  await logger.check('PUT /club-control/periods/:id edita datas, descrição e isActive', async () => {
    const body = { startDate: `${scratchYear}-02-08`, endDate: `${scratchYear}-12-05`, description: 'Descartável editado', isActive: true };
    const res = await editPeriod(http, scratch.id, body);
    expectFields(res.data, body, 'PUT período');
    const again = (await http.request('get', `/club-control/periods/${scratchYear}`)).data;
    expectFields(again, body, 'GET período');
    return `${again.startDate} -> ${again.endDate}`;
  });
  await logger.check('PUT /club-control/periods/:id parcial (só description) preserva as datas', async () => {
    const res = await editPeriod(http, scratch.id, { description: 'Só descrição' });
    expectFields(res.data, { description: 'Só descrição', startDate: `${scratchYear}-02-08` }, 'parcial');
    return 'ok';
  });
  await logger.check('PUT /club-control/periods/:id com endDate antes de startDate responde 4xx', () =>
    expectHttpError(() => editPeriod(http, scratch.id, { startDate: `${scratchYear}-12-01`, endDate: `${scratchYear}-01-01` }), [400, 409, 422], 'período invertido'),
  );
  await logger.check('PUT /club-control/periods/:id com year no corpo responde 400/422 (whitelist)', () =>
    expectHttpError(() => editPeriod(http, scratch.id, { year: 2050 }), [400, 422], 'período year'),
  );
  await runEditContractChecks({ logger, as, http, label: 'PUT /club-control/periods/:id', edit: editPeriod, validBody: { description: 'x' }, invalidBodies: [{ startDate: 'ontem' }, { isActive: 'sim' }], forbiddenRoles: ['coordinator', 'teacher'] });

  // Exceção descartável.
  const date = `${scratchYear}-06-15`;
  let exception;
  try {
    const found = (await http.request('get', `/club-control/exceptions/${date}`)).data;
    exception = found?.id ? found : null;
  } catch (e) {
    if (errorStatus(e) !== 404) throw e;
  }
  if (!exception) exception = (await http.request('post', '/club-control/exceptions', { data: { exceptionDate: date, reason: 'Descartável', type: 'other' } })).data;
  const editException = (client, id, body) => client.request('patch', `/club-control/exceptions/${id}`, { data: body });
  editException.sampleId = exception.id;

  await logger.check('PATCH /club-control/exceptions/:id edita todos os campos', async () => {
    const body = { exceptionDate: `${scratchYear}-06-16`, reason: 'Motivo editado', type: 'event', notes: 'Nota editada', isActive: true, isRecurrent: true };
    const res = await editException(http, exception.id, body);
    expectFields(res.data, body, 'PATCH exceção');
    const again = (await http.request('get', `/club-control/exceptions/${body.exceptionDate}`)).data;
    expectFields(again, { reason: body.reason, type: body.type }, 'GET exceção');
    return `${again.exceptionDate} ${again.type}`;
  });
  await logger.check('PATCH /club-control/exceptions/:id parcial (só notes) preserva o resto', async () => {
    const res = await editException(http, exception.id, { notes: 'Só nota' });
    expectFields(res.data, { notes: 'Só nota', reason: 'Motivo editado', type: 'event' }, 'parcial');
    return 'ok';
  });
  await logger.check('PATCH exceção para data de outra exceção responde 409/400', () =>
    expectHttpError(() => editException(http, exception.id, { exceptionDate: `${year}-04-21` }), [400, 409], 'exceção data dup'),
  );
  await runEditContractChecks({ logger, as, http, label: 'PATCH /club-control/exceptions/:id', edit: editException, validBody: { notes: 'x' }, invalidBodies: [{ type: 'ferias' }, { exceptionDate: 'x' }, { reason: 'x'.repeat(300) }], forbiddenRoles: ['coordinator', 'teacher'] });

  await http.request('delete', `/club-control/exceptions/${exception.id}`);
  await http.request('delete', `/club-control/periods/${scratch.id}`);
  return { period };
}

module.exports = { run };
