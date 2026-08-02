const { ACADEMIC_YEAR } = require('../common/config');

// Feriados nacionais brasileiros + eventos típicos do Clubinho
const NATIONAL_HOLIDAYS = [
  { date: '01-01', reason: 'Ano Novo', type: 'holiday', isRecurrent: true },
  { date: '04-21', reason: 'Tiradentes', type: 'holiday', isRecurrent: true },
  { date: '05-01', reason: 'Dia do Trabalho', type: 'holiday', isRecurrent: true },
  { date: '09-07', reason: 'Independência do Brasil', type: 'holiday', isRecurrent: true },
  { date: '10-12', reason: 'Nossa Senhora Aparecida', type: 'holiday', isRecurrent: true },
  { date: '11-02', reason: 'Finados', type: 'holiday', isRecurrent: true },
  { date: '11-15', reason: 'Proclamação da República', type: 'holiday', isRecurrent: true },
  { date: '12-25', reason: 'Natal', type: 'holiday', isRecurrent: true },
];

// Exceções especiais do Clubinho (não recorrentes, baseadas no ano)
function getClubinhoExceptions(year) {
  return [
    { date: `${year}-06-12`, reason: 'Festa Junina da Igreja', type: 'event', isRecurrent: false },
    { date: `${year}-07-14`, reason: 'Recesso de Férias Escolares', type: 'vacation', isRecurrent: false },
    { date: `${year}-07-21`, reason: 'Recesso de Férias Escolares', type: 'vacation', isRecurrent: false },
    { date: `${year}-10-02`, reason: 'Eleições Municipais', type: 'other', isRecurrent: false },
    { date: `${year}-11-20`, reason: 'Consciência Negra', type: 'holiday', isRecurrent: true },
    { date: `${year}-12-18`, reason: 'Encerramento do Ano Letivo', type: 'event', isRecurrent: false },
  ];
}

async function ensureAcademicPeriod({ http, year = ACADEMIC_YEAR }) {
  let period = null;
  try {
    const res = await http.request('get', `/club-control/periods/${year}`);
    period = res.data;
  } catch (_) {
    period = null;
  }

  if (period && period.startDate && period.endDate) {
    return period;
  }

  const createRes = await http.request('post', '/club-control/periods', {
    data: {
      year,
      startDate: `${year}-02-03`,
      endDate: `${year}-12-15`,
      description: `Ano Letivo ${year} - Clubinho NIB`,
      isActive: true,
    },
  });
  return createRes.data;
}

async function ensureExceptions({ http, logger, year = ACADEMIC_YEAR }) {
  const allExceptions = [
    ...NATIONAL_HOLIDAYS.map((h) => ({ ...h, date: `${year}-${h.date}` })),
    ...getClubinhoExceptions(year),
  ];

  let created = 0;
  let skipped = 0;

  for (const exc of allExceptions) {
    try {
      await http.request('post', '/club-control/exceptions', {
        data: {
          exceptionDate: exc.date,
          reason: exc.reason,
          type: exc.type,
          isRecurrent: exc.isRecurrent,
          isActive: true,
          notes: exc.notes || null,
        },
      });
      created++;
      logger.info(`[club-control/create] +1 exceção: ${exc.date} - ${exc.reason}`);
    } catch (e) {
      const status = e.response?.status;
      const msg = e.response?.data?.message || e.message;
      // 409 = já existe, ignora
      if (status === 409 || (typeof msg === 'string' && msg.toLowerCase().includes('unique'))) {
        skipped++;
      } else {
        logger.warn(`[club-control/create] falha exceção ${exc.date}: ${msg}`);
      }
    }
  }

  return { created, skipped, total: allExceptions.length };
}

async function run({ http, logger }) {
  const year = ACADEMIC_YEAR;
  logger.info(`[club-control/create] garantindo período letivo ${year}...`);
  const period = await ensureAcademicPeriod({ http, year });
  logger.info(`[club-control/create] OK período: ${period?.startDate} -> ${period?.endDate}`);

  logger.info(`[club-control/create] cadastrando feriados e exceções para ${year}...`);
  const excResult = await ensureExceptions({ http, logger, year });
  logger.info(
    `[club-control/create] OK exceções: criadas=${excResult.created} já existiam=${excResult.skipped} total=${excResult.total}`,
  );

  return { period, exceptions: excResult };
}

module.exports = { run, ensureAcademicPeriod };
