const { ACADEMIC_YEAR } = require('../common/config');
const { ensureRoleClients } = require('../common/role-users');
const { expectHttpError, errorStatus } = require('../common/errors');

/** Período letivo do ano, criado quando não existe. `GET` devolve vazio quando não há. */
async function ensureAcademicPeriod({ http, year = ACADEMIC_YEAR }) {
  let period = null;
  try {
    const res = await http.request('get', `/club-control/periods/${year}`);
    period = res.data && typeof res.data === 'object' ? res.data : null;
  } catch (e) {
    if (errorStatus(e) !== 404) throw e;
  }
  if (period?.startDate && period?.endDate) return period;

  const createRes = await http.request('post', '/club-control/periods', {
    data: {
      year,
      startDate: `${year}-02-02`,
      endDate: `${year}-12-15`,
      description: `Ano Letivo ${year}`,
      isActive: true,
    },
  });
  return createRes.data;
}

/** Exceção (feriado etc.) por data, criada quando não existe. */
async function ensureException({ http, exceptionDate, reason, type = 'holiday', notes, isRecurrent = false }) {
  try {
    const res = await http.request('get', `/club-control/exceptions/${exceptionDate}`);
    if (res.data && typeof res.data === 'object' && res.data.id) return { exception: res.data, created: false };
  } catch (e) {
    if (errorStatus(e) !== 404) throw e;
  }
  const res = await http.request('post', '/club-control/exceptions', {
    data: { exceptionDate, reason, type, notes, isActive: true, isRecurrent },
  });
  return { exception: res.data, created: true };
}

async function run({ http, logger, ctx }) {
  logger.section('club-control/create');
  const as = await ensureRoleClients({ http, logger, ctx });
  const year = ctx?.year ?? ACADEMIC_YEAR;

  const period = await ensureAcademicPeriod({ http, year });
  ctx.period = period;
  logger.ok(`período letivo ${year}: ${period.startDate} -> ${period.endDate} id=${period.id}`);

  await logger.check(`POST /club-control/periods repetindo o ano ${year} responde 409/400`, () =>
    expectHttpError(
      () => http.request('post', '/club-control/periods', { data: { year, startDate: `${year}-01-01`, endDate: `${year}-12-31` } }),
      [400, 409, 422],
      'período duplicado',
    ),
  );

  await logger.check('POST /club-control/periods com endDate antes de startDate responde 4xx', () =>
    expectHttpError(
      () => http.request('post', '/club-control/periods', { data: { year: 2099, startDate: '2099-12-01', endDate: '2099-01-01' } }),
      [400, 409, 422],
      'período invertido',
    ),
  );

  const exceptions = [
    { exceptionDate: `${year}-04-21`, reason: 'Tiradentes', type: 'holiday', isRecurrent: true },
    { exceptionDate: `${year}-11-15`, reason: 'Proclamação da República', type: 'holiday', isRecurrent: true },
    { exceptionDate: `${year}-07-15`, reason: 'Recesso de julho', type: 'vacation', notes: 'Criado pela automação' },
    { exceptionDate: `${year}-09-20`, reason: 'Evento geral da igreja', type: 'event' },
  ];
  ctx.exceptions = [];
  for (const spec of exceptions) {
    await logger.check(`exceção ${spec.exceptionDate} (${spec.type})`, async () => {
      const { exception, created } = await ensureException({ http, ...spec });
      ctx.exceptions.push(exception);
      return created ? 'criada' : 'já existia';
    });
  }

  await logger.check('POST /club-control/exceptions com type inválido responde 400/422', () =>
    expectHttpError(
      () => http.request('post', '/club-control/exceptions', { data: { exceptionDate: `${year}-03-03`, reason: 'x', type: 'ferias' } }),
      [400, 422],
      'exceção type',
    ),
  );

  if (as.coordinator) {
    await logger.check('POST /club-control/periods como coordenador responde 403', () =>
      expectHttpError(() => as.coordinator.request('post', '/club-control/periods', { data: { year: 2098, startDate: '2098-02-01', endDate: '2098-12-01' } }), 403, 'período coord'),
    );
  }

  return { period, exceptions: ctx.exceptions };
}

module.exports = { run, ensureAcademicPeriod, ensureException };
