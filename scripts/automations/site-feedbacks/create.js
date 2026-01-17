const { randomName, randomEmail } = require('../common/random');

async function run({ http, logger }) {
  const dto = {
    name: randomName(),
    email: randomEmail('feedback'),
    rating: 5,
    comment: 'Feedback created by automation',
    category: 'other',
  };
  logger.info('[site-feedbacks/create] creating feedback...');
  const res = await http.request('post', '/site-feedbacks', { data: dto });
  logger.info(`[site-feedbacks/create] OK id=${res.data?.id ?? 'n/a'}`);
  return { feedback: res.data };
}

module.exports = { run };
