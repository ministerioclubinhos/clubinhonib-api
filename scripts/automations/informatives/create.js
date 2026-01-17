async function run({ http, logger }) {
  const dto = {
    title: 'Banner Automação',
    description: 'Created by automation',
    public: true,
  };
  logger.info('[informatives/create] creating banner...');
  const res = await http.request('post', '/informatives', { data: dto });
  logger.info(`[informatives/create] OK id=${res.data?.id ?? 'n/a'}`);
  return { informative: res.data };
}

module.exports = { run };
