async function run({ http, logger }) {
  logger.info('[image-sections/list-fix] listando image-sections...');
  const res = await http.request('get', '/image-sections');
  const items = Array.isArray(res.data) ? res.data : [];
  logger.info(`[image-sections/list-fix] OK total=${items.length}`);
  if (items[0]?.id) {
    await http.request('get', `/image-sections/${items[0].id}`);
    logger.info('[image-sections/list-fix] OK /image-sections/:id');
  }
  return { imageSections: items };
}

module.exports = { run };
