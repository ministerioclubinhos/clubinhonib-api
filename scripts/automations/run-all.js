const { createHttpClient } = require('./common/http');
const { createLogger } = require('./logger');
const {
  USERS_TO_CREATE,
  MIN_CLUBS,
  MIN_TEACHERS_PER_CLUB,
  CHILDREN_PER_CLUB,
  WEEKS,
  MIN_PAGES_ITEMS,
} = require('./common/config');

const clubControlCreate = require('./club-control/create');
const clubControlListFix = require('./club-control/list-fix');

const usersCreate = require('./users/create');
const usersListFix = require('./users/list-fix');

const clubsCreate = require('./clubs/create');
const clubsListFix = require('./clubs/list-fix');

const childrenListFix = require('./children/list-fix');
const childrenCreate = require('./children/create');

const pagelasListFix = require('./pagelas/list-fix');
const pagelasCreate = require('./pagelas/create');
const pagelasFixZero = require('./pagelas/fix-zero');

const authCreate = require('./auth/create');
const authListFix = require('./auth/list-fix');

const acceptedChristsCreate = require('./accepted-christs/create');
const acceptedChristsListFix = require('./accepted-christs/list-fix');

const teacherProfilesCreate = require('./teacher-profiles/create');
const teacherProfilesListFix = require('./teacher-profiles/list-fix');

const coordinatorProfilesCreate = require('./coordinator-profiles/create');
const coordinatorProfilesListFix = require('./coordinator-profiles/list-fix');

const statisticsCreate = require('./statistics/create');
const statisticsListFix = require('./statistics/list-fix');

const routesCreate = require('./routes/create');
const routesListFix = require('./routes/list-fix');
const siteSmokeCreate = require('./site-smoke/create');
const siteSmokeListFix = require('./site-smoke/list-fix');

const commentsCreate = require('./comments/create');
const commentsListFix = require('./comments/list-fix');
const contactCreate = require('./contact/create');
const contactListFix = require('./contact/list-fix');
const documentsCreate = require('./documents/create');
const documentsListFix = require('./documents/list-fix');
const siteFeedbacksCreate = require('./site-feedbacks/create');
const siteFeedbacksListFix = require('./site-feedbacks/list-fix');
const informativesCreate = require('./informatives/create');
const informativesListFix = require('./informatives/list-fix');
const meditationsCreate = require('./meditations/create');
const meditationsListFix = require('./meditations/list-fix');
const eventsCreate = require('./events/create');
const eventsListFix = require('./events/list-fix');
const ideasPagesCreate = require('./ideas-pages/create');
const ideasPagesListFix = require('./ideas-pages/list-fix');
const ideasSectionsCreate = require('./ideas-sections/create');
const ideasSectionsListFix = require('./ideas-sections/list-fix');
const imagePagesCreate = require('./image-pages/create');
const imagePagesListFix = require('./image-pages/list-fix');
const imageSectionsCreate = require('./image-sections/create');
const imageSectionsListFix = require('./image-sections/list-fix');
const videoPagesCreate = require('./video-pages/create');
const videoPagesListFix = require('./video-pages/list-fix');
const weekMaterialPagesCreate = require('./week-material-pages/create');
const weekMaterialPagesListFix = require('./week-material-pages/list-fix');

function logSection(logger, title) {
  const line = '─'.repeat(60);
  logger.info(`\n${line}`);
  logger.info(`  ${title}`);
  logger.info(`${line}`);
}

async function runAll({ ctx = {} } = {}) {
  const logger = createLogger();
  const http = createHttpClient();

  const mergedCtx = {
    usersToCreate: USERS_TO_CREATE,
    minClubs: MIN_CLUBS,
    minTeachersPerClub: MIN_TEACHERS_PER_CLUB,
    childrenPerClub: CHILDREN_PER_CLUB,
    weeks: WEEKS,
    minPagesItems: MIN_PAGES_ITEMS,
    ...ctx,
  };

  logger.info('╔══════════════════════════════════════════════════════════╗');
  logger.info('║          CLUBINHO NIB - SEED COMPLETO DO BANCO           ║');
  logger.info('╚══════════════════════════════════════════════════════════╝');
  logger.info(`[run-all] Configurações: clubs=${mergedCtx.minClubs} teachers=${mergedCtx.minTeachersPerClub} children=${mergedCtx.childrenPerClub} pages=${mergedCtx.minPagesItems}`);

  logger.info('[run-all] verificando API + realizando login...');
  try {
    await http.login();
  } catch (err) {
    if (err?.code === 'ECONNREFUSED') {
      throw new Error('API não está rodando em localhost:3000 (ECONNREFUSED)');
    }
    throw err;
  }
  logger.info('[run-all] login OK ✓');

  const started = Date.now();

  // ─── 1. AUTENTICAÇÃO ────────────────────────────────────────────────────────
  logSection(logger, '1/12 · AUTENTICAÇÃO');
  await authCreate.run({ http, logger, ctx: mergedCtx });
  await authListFix.run({ http, logger, ctx: mergedCtx });

  // ─── 2. CALENDÁRIO LETIVO + EXCEÇÕES ────────────────────────────────────────
  logSection(logger, '2/12 · PERÍODO LETIVO E FERIADOS');
  await clubControlCreate.run({ http, logger, ctx: mergedCtx });
  await clubControlListFix.run({ http, logger, ctx: mergedCtx });

  // ─── 3. USUÁRIOS ────────────────────────────────────────────────────────────
  logSection(logger, '3/12 · USUÁRIOS (professores, coordenadores, admins)');
  await usersCreate.run({ http, logger, ctx: mergedCtx });
  await usersListFix.run({ http, logger, ctx: mergedCtx });

  // ─── 4. PERFIS ──────────────────────────────────────────────────────────────
  logSection(logger, '4/12 · PERFIS DE PROFESSORES E COORDENADORES');
  await teacherProfilesCreate.run({ http, logger, ctx: mergedCtx });
  await teacherProfilesListFix.run({ http, logger, ctx: mergedCtx });
  await coordinatorProfilesCreate.run({ http, logger, ctx: mergedCtx });
  await coordinatorProfilesListFix.run({ http, logger, ctx: mergedCtx });

  // ─── 5. CLUBES ──────────────────────────────────────────────────────────────
  logSection(logger, '5/12 · CLUBES (com coordenadores e professores)');
  await clubsCreate.run({ http, logger, ctx: mergedCtx });
  await clubsListFix.run({ http, logger, ctx: mergedCtx });

  // ─── 6. CRIANÇAS ────────────────────────────────────────────────────────────
  logSection(logger, '6/12 · CRIANÇAS (por clube)');
  await childrenListFix.run({ http, logger, ctx: mergedCtx });
  await childrenCreate.run({ http, logger, ctx: mergedCtx });
  await childrenListFix.run({ http, logger, ctx: mergedCtx });

  // ─── 7. PAGELAS ─────────────────────────────────────────────────────────────
  logSection(logger, '7/12 · PAGELAS (frequência semanal)');
  // Fix-zero primeiro: garante que crianças sem nenhuma pagela sejam preenchidas
  await pagelasFixZero.run({ http, logger, ctx: mergedCtx });
  // List-fix: preenche pagelas faltantes
  await pagelasListFix.run({ http, logger, ctx: mergedCtx });
  // Create: cria pagelas para novas semanas
  await pagelasCreate.run({ http, logger, ctx: mergedCtx });
  await pagelasListFix.run({ http, logger, ctx: mergedCtx });

  // ─── 8. ACEITAÇÕES DE CRISTO ────────────────────────────────────────────────
  logSection(logger, '8/12 · ACEITAÇÕES DE CRISTO');
  await acceptedChristsCreate.run({ http, logger, ctx: mergedCtx });
  await acceptedChristsListFix.run({ http, logger, ctx: mergedCtx });

  // ─── 9. ESTATÍSTICAS (read-only) ────────────────────────────────────────────
  logSection(logger, '9/12 · ESTATÍSTICAS (smoke test)');
  await statisticsCreate.run({ http, logger, ctx: mergedCtx });
  await statisticsListFix.run({ http, logger, ctx: mergedCtx });

  // ─── 10. ROTAS ──────────────────────────────────────────────────────────────
  logSection(logger, '10/12 · ROTAS');
  await routesCreate.run({ http, logger, ctx: mergedCtx });
  await routesListFix.run({ http, logger, ctx: mergedCtx });

  // ─── 11. CONTEÚDO DO SITE ───────────────────────────────────────────────────
  logSection(logger, '11/12 · CONTEÚDO DO SITE');

  await commentsCreate.run({ http, logger, ctx: mergedCtx });
  await commentsListFix.run({ http, logger, ctx: mergedCtx });

  await contactCreate.run({ http, logger, ctx: mergedCtx });
  await contactListFix.run({ http, logger, ctx: mergedCtx });

  await siteFeedbacksCreate.run({ http, logger, ctx: mergedCtx });
  await siteFeedbacksListFix.run({ http, logger, ctx: mergedCtx });

  await informativesCreate.run({ http, logger, ctx: mergedCtx });
  await informativesListFix.run({ http, logger, ctx: mergedCtx });

  await documentsCreate.run({ http, logger, ctx: mergedCtx });
  await documentsListFix.run({ http, logger, ctx: mergedCtx });

  await eventsCreate.run({ http, logger, ctx: mergedCtx });
  await eventsListFix.run({ http, logger, ctx: mergedCtx });

  await meditationsCreate.run({ http, logger, ctx: mergedCtx });
  await meditationsListFix.run({ http, logger, ctx: mergedCtx });

  await ideasSectionsCreate.run({ http, logger, ctx: mergedCtx });
  await ideasSectionsListFix.run({ http, logger, ctx: mergedCtx });

  await ideasPagesCreate.run({ http, logger, ctx: mergedCtx });
  await ideasPagesListFix.run({ http, logger, ctx: mergedCtx });

  await imageSectionsCreate.run({ http, logger, ctx: mergedCtx });
  await imageSectionsListFix.run({ http, logger, ctx: mergedCtx });

  await imagePagesCreate.run({ http, logger, ctx: mergedCtx });
  await imagePagesListFix.run({ http, logger, ctx: mergedCtx });

  await videoPagesCreate.run({ http, logger, ctx: mergedCtx });
  await videoPagesListFix.run({ http, logger, ctx: mergedCtx });

  await weekMaterialPagesCreate.run({ http, logger, ctx: mergedCtx });
  await weekMaterialPagesListFix.run({ http, logger, ctx: mergedCtx });

  // ─── 12. SMOKE TEST FINAL ───────────────────────────────────────────────────
  logSection(logger, '12/12 · SMOKE TEST FINAL DO SITE');
  await siteSmokeCreate.run({ http, logger, ctx: mergedCtx });
  await siteSmokeListFix.run({ http, logger, ctx: mergedCtx });

  const durationS = ((Date.now() - started) / 1000).toFixed(2);
  logger.info('\n╔══════════════════════════════════════════════════════════╗');
  logger.info(`║  ✅ SEED COMPLETO EM ${durationS.padStart(8)}s                          ║`);
  logger.info('║  Todas as entidades foram alimentadas com sucesso!       ║');
  logger.info('╚══════════════════════════════════════════════════════════╝');
}

module.exports = { runAll };
