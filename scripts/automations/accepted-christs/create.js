async function run({ http, logger }) {
  logger.info('[accepted-christs/create] creating accepted-christ (needs 1 childId)...');

  const childrenRes = await http.request('get', '/children/simple');
  const children = Array.isArray(childrenRes.data) ? childrenRes.data : [];
  if (children.length === 0) {
    logger.warn('[accepted-christs/create] no children. skipping.');
    return { created: false };
  }

  const childId = children[0].id;
  try {
    const res = await http.request('post', '/accepted-christs', {
      data: {
        childId,
        decision: 'ACCEPTED',
        notes: 'Created by automation',
      },
    });
    logger.info(`[accepted-christs/create] OK id=${res.data?.id ?? 'n/a'} childId=${childId}`);
    return { created: true };
  } catch (e) {
    const status = e.response?.status;
    
    logger.warn(`[accepted-christs/create] failed status=${status ?? 'n/a'}: ${e.response?.data?.message || e.message}`);
    return { created: false };
  }
}

module.exports = { run };


