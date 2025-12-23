const { fetchAllPages } = require('../common/pagination');

async function run({ http, logger }) {
  logger.info('[site-smoke/list-fix] smoke GETs de controllers de conteúdo/site...');

  // events
  try {
    const events = await http.request('get', '/events');
    logger.info(`[site-smoke] OK /events total=${Array.isArray(events.data) ? events.data.length : 0}`);
  } catch (e) {
    logger.warn(`[site-smoke] /events falhou: ${e.response?.data?.message || e.message}`);
  }
  try {
    const upcoming = await http.request('get', '/events/upcoming');
    logger.info(`[site-smoke] OK /events/upcoming total=${Array.isArray(upcoming.data) ? upcoming.data.length : 0}`);
  } catch (e) {
    logger.warn(`[site-smoke] /events/upcoming falhou: ${e.response?.data?.message || e.message}`);
  }

  // ideas pages/sections
  try {
    const pages = await http.request('get', '/ideas-pages');
    const arr = Array.isArray(pages.data) ? pages.data : [];
    logger.info(`[site-smoke] OK /ideas-pages total=${arr.length}`);
    if (arr[0]?.id) await http.request('get', `/ideas-pages/${arr[0].id}`);
  } catch (e) {
    logger.warn(`[site-smoke] /ideas-pages falhou: ${e.response?.data?.message || e.message}`);
  }

  try {
    const sections = await http.request('get', '/ideas-sections');
    const arr = Array.isArray(sections.data) ? sections.data : [];
    logger.info(`[site-smoke] OK /ideas-sections total=${arr.length}`);
    if (arr[0]?.id) await http.request('get', `/ideas-sections/${arr[0].id}`);
  } catch (e) {
    logger.warn(`[site-smoke] /ideas-sections falhou: ${e.response?.data?.message || e.message}`);
  }

  // image pages/sections
  try {
    const imgPages = await http.request('get', '/image-pages');
    const arr = Array.isArray(imgPages.data) ? imgPages.data : [];
    logger.info(`[site-smoke] OK /image-pages total=${arr.length}`);
    if (arr[0]?.id) {
      await http.request('get', `/image-pages/${arr[0].id}`);

      // sections paginated — percorrer todas páginas
      const sections = await fetchAllPages(
        http.request,
        'get',
        `/image-pages/${arr[0].id}/sections`,
        {},
        { limit: 2, maxPages: 50 },
      );
      logger.info(`[site-smoke] OK /image-pages/:id/sections totalFetched=${sections.length}`);
    }
  } catch (e) {
    logger.warn(`[site-smoke] /image-pages falhou: ${e.response?.data?.message || e.message}`);
  }

  try {
    const imgSections = await http.request('get', '/image-sections');
    const arr = Array.isArray(imgSections.data) ? imgSections.data : [];
    logger.info(`[site-smoke] OK /image-sections total=${arr.length}`);
    if (arr[0]?.id) await http.request('get', `/image-sections/${arr[0].id}`);
  } catch (e) {
    logger.warn(`[site-smoke] /image-sections falhou: ${e.response?.data?.message || e.message}`);
  }

  // video pages
  try {
    const vids = await http.request('get', '/video-pages');
    const arr = Array.isArray(vids.data) ? vids.data : [];
    logger.info(`[site-smoke] OK /video-pages total=${arr.length}`);
    if (arr[0]?.id) await http.request('get', `/video-pages/${arr[0].id}`);
  } catch (e) {
    logger.warn(`[site-smoke] /video-pages falhou: ${e.response?.data?.message || e.message}`);
  }

  // week material pages
  try {
    const w = await http.request('get', '/week-material-pages');
    const arr = Array.isArray(w.data) ? w.data : [];
    logger.info(`[site-smoke] OK /week-material-pages total=${arr.length}`);
  } catch (e) {
    logger.warn(`[site-smoke] /week-material-pages falhou: ${e.response?.data?.message || e.message}`);
  }
  try {
    await http.request('get', '/week-material-pages/current-week');
    logger.info('[site-smoke] OK /week-material-pages/current-week');
  } catch (e) {
    logger.warn(`[site-smoke] /week-material-pages/current-week falhou: ${e.response?.data?.message || e.message}`);
  }

  // meditations / informatives
  try {
    const m = await http.request('get', '/meditations');
    const arr = Array.isArray(m.data) ? m.data : [];
    logger.info(`[site-smoke] OK /meditations total=${arr.length}`);
  } catch (e) {
    logger.warn(`[site-smoke] /meditations falhou: ${e.response?.data?.message || e.message}`);
  }
  try {
    await http.request('get', '/meditations/this-week');
    logger.info('[site-smoke] OK /meditations/this-week');
  } catch (e) {
    logger.warn(`[site-smoke] /meditations/this-week falhou: ${e.response?.data?.message || e.message}`);
  }

  try {
    const inf = await http.request('get', '/informatives');
    const arr = Array.isArray(inf.data) ? inf.data : [];
    logger.info(`[site-smoke] OK /informatives total=${arr.length}`);
  } catch (e) {
    logger.warn(`[site-smoke] /informatives falhou: ${e.response?.data?.message || e.message}`);
  }

  // documents
  try {
    const docs = await http.request('get', '/documents');
    const arr = Array.isArray(docs.data) ? docs.data : [];
    logger.info(`[site-smoke] OK /documents total=${arr.length}`);
    if (arr[0]?.id) await http.request('get', `/documents/${arr[0].id}`);
  } catch (e) {
    logger.warn(`[site-smoke] /documents falhou: ${e.response?.data?.message || e.message}`);
  }

  // comments (public)
  try {
    const published = await http.request('get', '/comments/published');
    const arr = Array.isArray(published.data) ? published.data : [];
    logger.info(`[site-smoke] OK /comments/published total=${arr.length}`);
  } catch (e) {
    logger.warn(`[site-smoke] /comments/published falhou: ${e.response?.data?.message || e.message}`);
  }

  // app root
  try {
    await http.request('get', '/');
    logger.info('[site-smoke] OK GET /');
  } catch (e) {
    logger.warn(`[site-smoke] GET / falhou: ${e.response?.status ?? ''}`);
  }

  return { ok: true };
}

module.exports = { run };


