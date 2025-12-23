const { randomName } = require('../common/random');

async function run({ http, logger }) {
  const dto = {
    name: randomName(),
    comment: 'Comentário criado pela automação',
    clubinho: 'Clubinho Teste',
    neighborhood: 'Centro',
  };
  logger.info('[comments/create] criando comentário...');
  const res = await http.request('post', '/comments', { data: dto });
  logger.info(`[comments/create] OK id=${res.data?.id ?? 'n/a'}`);
  return { comment: res.data };
}

module.exports = { run };
