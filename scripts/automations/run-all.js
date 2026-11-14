const { createHttpClient } = require('./common/http');
const { createLogger } = require('./logger');
const { errorMessage, errorStatus } = require('./common/errors');
const {
  USERS_TO_CREATE, MIN_CLUBS, MIN_TEACHERS_PER_CLUB, CHILDREN_PER_CLUB, WEEKS, MIN_PAGES_ITEMS, ACADEMIC_YEAR,
  AUTO_SEED_SUPERUSER, API_BASE_URL,
} = require('./common/config');

/**
 * Ordem importa: usuários de papel antes de tudo (os demais módulos usam as
 * sessões), período letivo antes de pagelas, clubinhos antes de crianças, e
 * páginas antes das seções que se anexam a elas.
 */
const STEPS = [
  ['feature-flags/create', require('./feature-flags/create')],
  ['users/create', require('./users/create')],
  ['users/list-fix', require('./users/list-fix')],
  ['users/update', require('./users/update')],
  ['auth/create', require('./auth/create')],
  ['club-control/create', require('./club-control/create')],
  ['clubs/create', require('./clubs/create')],
  ['clubs/list-fix', require('./clubs/list-fix')],
  ['clubs/update', require('./clubs/update')],
  ['teacher-profiles/create', require('./teacher-profiles/create')],
  ['teacher-profiles/list-fix', require('./teacher-profiles/list-fix')],
  ['teacher-profiles/update', require('./teacher-profiles/update')],
  ['coordinator-profiles/create', require('./coordinator-profiles/create')],
  ['coordinator-profiles/list-fix', require('./coordinator-profiles/list-fix')],
  ['coordinator-profiles/update', require('./coordinator-profiles/update')],
  ['auth/list-fix', require('./auth/list-fix')],
  ['profile/create', require('./profile/create')],
  ['profile/list-fix', require('./profile/list-fix')],
  ['profile/update', require('./profile/update')],
  ['profiles/create', require('./profiles/create')],
  ['profiles/list-fix', require('./profiles/list-fix')],
  ['profiles/update', require('./profiles/update')],
  ['feature-flags/list-fix', require('./feature-flags/list-fix')],
  ['feature-flags/update', require('./feature-flags/update')],
  ['club-control/list-fix', require('./club-control/list-fix')],
  ['club-control/update', require('./club-control/update')],
  ['children/create', require('./children/create')],
  ['children/list-fix', require('./children/list-fix')],
  ['children/update', require('./children/update')],
  ['pagelas/fix-zero', require('./pagelas/fix-zero')],
  ['pagelas/create', require('./pagelas/create')],
  ['pagelas/list-fix', require('./pagelas/list-fix')],
  ['pagelas/update', require('./pagelas/update')],
  ['accepted-christs/create', require('./accepted-christs/create')],
  ['accepted-christs/list-fix', require('./accepted-christs/list-fix')],
  ['statistics/create', require('./statistics/create')],
  ['statistics/list-fix', require('./statistics/list-fix')],
  ['comments/create', require('./comments/create')],
  ['comments/list-fix', require('./comments/list-fix')],
  ['comments/update', require('./comments/update')],
  ['contact/create', require('./contact/create')],
  ['contact/list-fix', require('./contact/list-fix')],
  ['contact/update', require('./contact/update')],
  ['site-feedbacks/create', require('./site-feedbacks/create')],
  ['site-feedbacks/list-fix', require('./site-feedbacks/list-fix')],
  ['site-feedbacks/update', require('./site-feedbacks/update')],
  ['informatives/create', require('./informatives/create')],
  ['informatives/list-fix', require('./informatives/list-fix')],
  ['informatives/update', require('./informatives/update')],
  ['documents/create', require('./documents/create')],
  ['documents/list-fix', require('./documents/list-fix')],
  ['documents/update', require('./documents/update')],
  ['events/create', require('./events/create')],
  ['events/list-fix', require('./events/list-fix')],
  ['events/update', require('./events/update')],
  ['meditations/create', require('./meditations/create')],
  ['meditations/list-fix', require('./meditations/list-fix')],
  ['meditations/update', require('./meditations/update')],
  ['ideas-pages/create', require('./ideas-pages/create')],
  ['ideas-sections/create', require('./ideas-sections/create')],
  ['ideas-sections/list-fix', require('./ideas-sections/list-fix')],
  ['ideas-sections/update', require('./ideas-sections/update')],
  ['ideas-pages/list-fix', require('./ideas-pages/list-fix')],
  ['ideas-pages/update', require('./ideas-pages/update')],
  ['image-pages/create', require('./image-pages/create')],
  ['image-sections/create', require('./image-sections/create')],
  ['image-sections/list-fix', require('./image-sections/list-fix')],
  ['image-sections/update', require('./image-sections/update')],
  ['image-pages/list-fix', require('./image-pages/list-fix')],
  ['image-pages/update', require('./image-pages/update')],
  ['video-pages/create', require('./video-pages/create')],
  ['video-pages/list-fix', require('./video-pages/list-fix')],
  ['video-pages/update', require('./video-pages/update')],
  ['week-material-pages/create', require('./week-material-pages/create')],
  ['week-material-pages/list-fix', require('./week-material-pages/list-fix')],
  ['week-material-pages/update', require('./week-material-pages/update')],
  ['routes/create', require('./routes/create')],
  ['routes/list-fix', require('./routes/list-fix')],
  ['site-smoke/create', require('./site-smoke/create')],
  ['site-smoke/list-fix', require('./site-smoke/list-fix')],
];

/** Login do superusuário; sem ele, semeia no banco local e tenta de novo. */
async function loginSuperuser({ http, logger }) {
  try {
    await http.login();
    return;
  } catch (err) {
    if (err?.code === 'ECONNREFUSED') throw new Error(`API não está respondendo em ${API_BASE_URL} (ECONNREFUSED)`);
    if (errorStatus(err) !== 401 || !AUTO_SEED_SUPERUSER) throw err;
    logger.warn(`[run-all] login do superusuário falhou (${errorMessage(err)}); semeando no banco local...`);
    const { seedSuperuser } = require('./bootstrap/seed-superuser');
    await seedSuperuser({ logger });
    await http.login();
  }
}

/**
 * `only`: lista de prefixos (ex.: `['clubs', 'children/create']`) para rodar
 * só alguns passos. Os passos de `users/create` sempre entram, porque abrem as
 * sessões por papel usadas pelos demais.
 */
async function runAll({ ctx = {}, only = [] } = {}) {
  const logger = createLogger();
  const http = createHttpClient();

  const mergedCtx = {
    usersToCreate: USERS_TO_CREATE,
    minClubs: MIN_CLUBS,
    minTeachersPerClub: MIN_TEACHERS_PER_CLUB,
    childrenPerClub: CHILDREN_PER_CLUB,
    weeks: WEEKS,
    minPagesItems: MIN_PAGES_ITEMS,
    year: ACADEMIC_YEAR,
    ...ctx,
  };

  logger.info(`[run-all] API=${API_BASE_URL} ano letivo=${mergedCtx.year}`);
  await loginSuperuser({ http, logger });
  logger.info('[run-all] login OK');

  const started = Date.now();
  const selected = only.length ? STEPS.filter(([name]) => name === 'users/create' || only.some((p) => name.startsWith(p))) : STEPS;

  for (const [name, mod] of selected) {
    const stepStarted = Date.now();
    try {
      await mod.run({ http, logger, ctx: mergedCtx });
      logger.info(`[run-all] ${name} concluído em ${((Date.now() - stepStarted) / 1000).toFixed(1)}s`);
    } catch (err) {
      logger.error(`[run-all] ${name} abortou: ${errorMessage(err)}`);
      if (process.env.STOP_ON_FAIL === '1') throw err;
    }
  }

  logger.info(`[run-all] completado em ${((Date.now() - started) / 1000).toFixed(2)}s`);
  logger.printSummary();
  return logger.summary;
}

module.exports = { runAll, STEPS };
