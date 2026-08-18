const { randomName, randomEmail, randomSiteFeedback } = require('../common/random');
const { sleep } = require('../common/sleep');

const FEEDBACK_CATEGORIES = [
  'content', 'appearance', 'usability', 'broken_feature',
  'missing_feature', 'performance', 'mobile_experience', 'suggestion', 'complaint', 'other',
];

async function run({ http, logger, ctx }) {
  const min = ctx?.minPagesItems ?? 10;

  // Verifica quantos feedbacks já existem
  let existing = 0;
  try {
    const listRes = await http.request('get', '/site-feedbacks', { params: { page: 1, limit: 1 } });
    existing = listRes.data?.total ?? listRes.data?.meta?.totalItems ?? 0;
  } catch (_) {}

  const toCreate = Math.max(0, min - existing);
  logger.info(`[site-feedbacks/create] garantindo mínimo ${min} feedbacks (atual=${existing}, criando=${toCreate})...`);

  let created = 0;
  for (let i = 0; i < toCreate; i++) {
    const feedbackData = randomSiteFeedback();
    const category = FEEDBACK_CATEGORIES[Math.floor(Math.random() * FEEDBACK_CATEGORIES.length)];
    const dto = {
      name: randomName(),
      email: Math.random() > 0.3 ? randomEmail('feedback') : undefined,
      rating: feedbackData.rating,
      comment: feedbackData.comment,
      category,
    };
    try {
      await http.request('post', '/site-feedbacks', { data: dto });
      created++;
      logger.info(`[site-feedbacks/create] +1 feedback rating=${dto.rating} categoria=${category}`);
      await sleep(30);
    } catch (e) {
      logger.warn(`[site-feedbacks/create] falhou: ${e.response?.data?.message || e.message}`);
    }
  }

  logger.info(`[site-feedbacks/create] OK criados=${created}`);
  return { created };
}

module.exports = { run };
