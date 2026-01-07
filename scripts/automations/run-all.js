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

  logger.info('[run-all] verificando API + login...');
  try {
    await http.login();
  } catch (err) {
    if (err?.code === 'ECONNREFUSED') {
      throw new Error('API não está rodando em localhost:3000 (ECONNREFUSED)');
    }
    throw err;
  }
  logger.info('[run-all] login OK');

  const started = Date.now();

  
  await authCreate.run({ http, logger, ctx: mergedCtx });
  await authListFix.run({ http, logger, ctx: mergedCtx });

  
  await clubControlCreate.run({ http, logger, ctx: mergedCtx });
  await clubControlListFix.run({ http, logger, ctx: mergedCtx });

  
  await usersCreate.run({ http, logger, ctx: mergedCtx });
  await usersListFix.run({ http, logger, ctx: mergedCtx });

  
  await teacherProfilesCreate.run({ http, logger, ctx: mergedCtx });
  await teacherProfilesListFix.run({ http, logger, ctx: mergedCtx });
  await coordinatorProfilesCreate.run({ http, logger, ctx: mergedCtx });
  await coordinatorProfilesListFix.run({ http, logger, ctx: mergedCtx });

  
  await clubsCreate.run({ http, logger, ctx: mergedCtx });
  await clubsListFix.run({ http, logger, ctx: mergedCtx });

  
  await childrenListFix.run({ http, logger, ctx: mergedCtx });
  await childrenCreate.run({ http, logger, ctx: mergedCtx });
  await childrenListFix.run({ http, logger, ctx: mergedCtx });

  
  
  await pagelasFixZero.run({ http, logger, ctx: mergedCtx });
  
  await pagelasListFix.run({ http, logger, ctx: mergedCtx });
  await pagelasCreate.run({ http, logger, ctx: mergedCtx });
  await pagelasListFix.run({ http, logger, ctx: mergedCtx });

  
  await acceptedChristsCreate.run({ http, logger, ctx: mergedCtx });
  await acceptedChristsListFix.run({ http, logger, ctx: mergedCtx });

  
  await statisticsCreate.run({ http, logger, ctx: mergedCtx });
  await statisticsListFix.run({ http, logger, ctx: mergedCtx });

  
  await routesCreate.run({ http, logger, ctx: mergedCtx });
  await routesListFix.run({ http, logger, ctx: mergedCtx });

  
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

  
  await siteSmokeCreate.run({ http, logger, ctx: mergedCtx });
  await siteSmokeListFix.run({ http, logger, ctx: mergedCtx });

  const durationS = ((Date.now() - started) / 1000).toFixed(2);
  logger.info(`[run-all] concluído em ${durationS}s`);
}

module.exports = { runAll };


